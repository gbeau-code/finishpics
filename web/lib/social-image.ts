/**
 * social-image.ts — server-side Sharp renderer for Social Studio graphics
 *
 * Renders the deliverable Post (1080×1080) / Story (1080×1920) JPEGs from the
 * CLEAN heat image. Layout is driven by TEMPLATE_SPECS in graphic-spec.ts —
 * the same spec the client FinishPreview consumes — so the download pixel-
 * matches the on-page preview (preview 360w × 3 = 1080w output).
 *
 * SECURITY: this is the only place the clean image meets the social overlay;
 * it runs server-side only. Callers gate access via resolveAccess().
 */

import sharp from 'sharp'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { ROBOTO_CONDENSED_BOLD_B64, ROBOTO_CONDENSED_REGULAR_B64 } from './font-data'
import {
  ROBOTO_CONDENSED_EXTRABOLD_ITALIC_B64,
  ROBOTO_CONDENSED_EXTRABOLD_B64,
} from './font-data-italic'
import {
  BASE_W, COLORS, FORMAT_DIMENSIONS, TAG_LABELS, TEMPLATE_SPECS,
} from './graphic-spec'
import type { SocialGraphicConfig, TextSpec } from './graphic-spec'

export interface SocialRenderInfo {
  name:       string
  team:       string | null
  /** Event label as shown on the overlay, e.g. "Boys 3000 Meter Run". */
  eventLabel: string
  /** Formatted finish time, e.g. "8:45.06" (null → overlays hide the time). */
  timeLabel:  string | null
  meetName:   string
  /** Venue / meet location for the card footer line. */
  venue?:     string | null
  /** Timing company for the "Captured by …" credit on the card. */
  companyName?: string | null
}

// ---------------------------------------------------------------------------
// Font bootstrap — write TTFs to /tmp once per Lambda instance
// ---------------------------------------------------------------------------

let _fontsReady = false
function ensureFonts() {
  const tmp = os.tmpdir()
  const files = {
    regular:      [path.join(tmp, 'FP-Regular.ttf'),     ROBOTO_CONDENSED_REGULAR_B64],
    bold:         [path.join(tmp, 'FP-Bold.ttf'),        ROBOTO_CONDENSED_BOLD_B64],
    extrabold:    [path.join(tmp, 'FP-XBold.ttf'),       ROBOTO_CONDENSED_EXTRABOLD_B64],
    extraboldIt:  [path.join(tmp, 'FP-XBoldItalic.ttf'), ROBOTO_CONDENSED_EXTRABOLD_ITALIC_B64],
  } as const
  if (!_fontsReady) {
    for (const [path, b64] of Object.values(files)) {
      if (!fs.existsSync(path)) fs.writeFileSync(path, Buffer.from(b64, 'base64'))
    }
    _fontsReady = true
  }
  return {
    regular:     files.regular[0],
    bold:        files.bold[0],
    extrabold:   files.extrabold[0],
    extraboldIt: files.extraboldIt[0],
  }
}

/**
 * Font file + Pango description for a TextSpec. BOTH matter: fontfile makes
 * the face available (Lambda has no system fonts), and the font_desc family/
 * style keywords make Pango actually select it (otherwise it falls back to
 * the platform default).
 */
function fontFor(spec: TextSpec): { file: string; desc: string } {
  const f = ensureFonts()
  if (spec.italic)      return { file: f.extraboldIt, desc: 'Roboto Condensed Ultra-Bold Italic' }
  if (spec.weight >= 800) return { file: f.extrabold, desc: 'Roboto Condensed Ultra-Bold' }
  if (spec.weight >= 600) return { file: f.bold,      desc: 'Roboto Condensed Bold' }
  return { file: f.regular, desc: 'Roboto Condensed' }
}

// ---------------------------------------------------------------------------
// Text rendering (Pango via sharp text input)
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** rgba()/#hex → Pango-safe foreground + alpha attribute. */
function pangoColor(color: string): { fg: string; alpha: string } {
  const m = color.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/)
  if (!m) return { fg: color, alpha: '' }
  const hex = '#' + [m[1], m[2], m[3]]
    .map(n => Number(n).toString(16).padStart(2, '0')).join('')
  return { fg: hex, alpha: ` alpha="${Math.round(Number(m[4]) * 65535)}"` }
}

interface RenderedText { data: Buffer; width: number; height: number }

/** Render one line of styled text → trimmed transparent PNG + dimensions. */
async function textLayer(
  text: string,
  spec: TextSpec,
  k: number,               // scale factor outputW / BASE_W
  colorOverride?: string,
): Promise<RenderedText> {
  const content  = spec.uppercase ? text.toUpperCase() : text
  const px       = spec.size * k
  const pt       = px * 0.75                       // dpi 96
  const ls       = spec.tracking
    ? ` letter_spacing="${Math.round(spec.tracking * pt * 1024)}"`
    : ''
  const { fg, alpha } = pangoColor(colorOverride ?? spec.color)
  const font = fontFor(spec)
  const markup = `<span foreground="${fg}"${alpha} font_desc="${font.desc} ${pt}"${ls}>${esc(content)}</span>`

  const buf = await sharp({
    text: { text: markup, fontfile: font.file, width: 4000, rgba: true, dpi: 96 },
  }).png().toBuffer()

  const meta = await sharp(buf).metadata()
  return { data: buf, width: meta.width ?? 0, height: meta.height ?? 0 }
}

/** Soft dark copy of a text layer — stands in for CSS text-shadow. */
async function shadowLayer(
  text: string,
  spec: TextSpec,
  k: number,
): Promise<Buffer> {
  const black = await textLayer(text, spec, k, '#000000')
  return sharp(black.data).blur(Math.max(0.5, 2.0 * k)).toBuffer()
}

// ---------------------------------------------------------------------------
// SVG helpers (scrims, tiles, pills, flag icon)
// ---------------------------------------------------------------------------

/** Convert our known CSS 180deg linear-gradients into a full-frame SVG. */
function scrimSvg(cssGradient: string, w: number, h: number): Buffer {
  const stops = [...cssGradient.matchAll(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)\s+([\d.]+)%/g)]
    .map(m => ({
      color: `rgb(${m[1]},${m[2]},${m[3]})`,
      opacity: Number(m[4]),
      offset: Number(m[5]),
    }))
  const stopTags = stops
    .map(s => `<stop offset="${s.offset}%" stop-color="${s.color}" stop-opacity="${s.opacity}"/>`)
    .join('')
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">${stopTags}</linearGradient></defs>
      <rect width="${w}" height="${h}" fill="url(#g)"/>
    </svg>`,
  )
}

/** Lucide "flag" icon (stroke) inside a rounded tile. */
function flagTileSvg(size: number, radius: number, bg: string, iconColor: string): Buffer {
  const icon = size * 0.62
  const off  = (size - icon) / 2
  const sw   = Math.max(1, size / 9)
  return Buffer.from(
    `<svg width="${Math.round(size)}" height="${Math.round(size)}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/>
      <g transform="translate(${off},${off}) scale(${icon / 24})"
         fill="none" stroke="${iconColor}" stroke-width="${sw * 24 / icon}"
         stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
        <line x1="4" x2="4" y1="22" y2="15"/>
      </g>
    </svg>`,
  )
}

function pillSvg(w: number, h: number, fill: string): Buffer {
  return Buffer.from(
    `<svg width="${Math.round(w)}" height="${Math.round(h)}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${w}" height="${h}" rx="${h / 2}" fill="${fill}"/>
    </svg>`,
  )
}

function rectSvg(w: number, h: number, fill: string): Buffer {
  return Buffer.from(
    `<svg width="${Math.round(w)}" height="${Math.round(h)}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${w}" height="${h}" fill="${fill}"/>
    </svg>`,
  )
}

/** Repeating diagonal SAMPLE watermark (matches the preview's .wm tile). */
function watermarkSvg(w: number, h: number, k: number): Buffer {
  const tw = 208 * k, th = 58 * k, fs = 11 * k
  let tiles = ''
  for (let y = 0; y < h; y += th) {
    for (let x = 0; x < w; x += tw) {
      tiles += `<g transform="translate(${x},${y})">
        <text x="${6 * k}" y="${20 * k}">SAMPLE · FinishPics.com</text>
        <text x="${-98 * k}" y="${46 * k}">SAMPLE · FinishPics.com</text>
        <text x="${110 * k}" y="${46 * k}">SAMPLE · FinishPics.com</text>
      </g>`
    }
  }
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <g font-family="Arial,Helvetica,sans-serif" font-size="${fs}" font-weight="700"
         fill="rgba(45,45,45,0.5)">${tiles}</g>
    </svg>`,
  )
}

// ---------------------------------------------------------------------------
// Focal-point cover crop
// ---------------------------------------------------------------------------

async function focalCoverCrop(
  source: Buffer,
  outW: number,
  outH: number,
  focalX: number,   // 0–100
  focalY: number,
): Promise<Buffer> {
  const meta = await sharp(source).metadata()
  const sw = meta.width!, sh = meta.height!

  const scale = Math.max(outW / sw, outH / sh)
  const cropW = Math.min(sw, Math.round(outW / scale))
  const cropH = Math.min(sh, Math.round(outH / scale))
  // CSS background-position semantics — the SAME math the FinishPreview photo
  // layer uses (backgroundPosition: x% y% → offset = p% × (src − crop)), so
  // the delivered crop matches the approved preview exactly.
  const left = Math.round(Math.max(0, Math.min(sw - cropW, (focalX / 100) * (sw - cropW))))
  const top  = Math.round(Math.max(0, Math.min(sh - cropH, (focalY / 100) * (sh - cropH))))

  return sharp(source)
    .extract({ left, top, width: cropW, height: cropH })
    .resize(outW, outH)
    .toBuffer()
}

// ---------------------------------------------------------------------------
// Main renderer
// ---------------------------------------------------------------------------

type Layer = sharp.OverlayOptions

export async function renderSocialGraphic(
  source: Buffer,
  info:   SocialRenderInfo,
  config: SocialGraphicConfig,
  opts:   { watermark?: boolean } = {},
): Promise<Buffer> {
  const { w: W, h: H } = FORMAT_DIMENSIONS[config.format]
  const k = W / BASE_W
  const spec = TEMPLATE_SPECS[config.template]
  const tagLabel = TAG_LABELS[config.tag]

  const photo = await focalCoverCrop(source, W, H, config.focal.x, config.focal.y)
  const layers: Layer[] = []

  const addText = async (text: string, spec: TextSpec, layer: RenderedText, left: number, top: number) => {
    if (spec.shadow) {
      layers.push({ input: await shadowLayer(text, spec, k), left: Math.round(left), top: Math.round(top + 1.5 * k) })
    }
    layers.push({ input: layer.data, left: Math.round(left), top: Math.round(top) })
  }

  // ── template layouts (positions mirror FinishPreview.dc.html) ────────────
  if (spec.kind === 'whitegold') {
    layers.push({ input: scrimSvg(spec.scrim, W, H), left: 0, top: 0 })

    // Brand chip, top-left
    const b = spec.brand
    layers.push({ input: flagTileSvg(b.tile * k, b.tileRadius * k, COLORS.gold, COLORS.ink), left: Math.round(b.offset * k), top: Math.round(b.offset * k) })
    const brandText = await textLayer('FinishPics', b.text, k)
    await addText('FinishPics', b.text, brandText, (b.offset + b.tile + 7) * k, b.offset * k + (b.tile * k - brandText.height) / 2)

    // Bottom-centered stack (bottom-up: meetLine, nameLine, time, tag)
    const [, , padB] = spec.pad
    let cursor = H - padB * k

    const meetLine = await textLayer(info.meetName, spec.meetLine, k)
    cursor -= meetLine.height
    await addText(info.meetName, spec.meetLine, meetLine, (W - meetLine.width) / 2, cursor)
    cursor -= spec.meetLine.marginTop * k

    const nameLine = await textLayer(`${info.name} · ${info.eventLabel}`, spec.nameLine, k)
    cursor -= nameLine.height
    await addText(`${info.name} · ${info.eventLabel}`, spec.nameLine, nameLine, (W - nameLine.width) / 2, cursor)
    cursor -= spec.nameLine.marginTop * k

    if (info.timeLabel) {
      const time = await textLayer(info.timeLabel, spec.time, k)
      cursor -= time.height
      await addText(info.timeLabel!, spec.time, time, (W - time.width) / 2, cursor)
    }

    if (tagLabel) {
      cursor -= spec.tag.marginBottom * k
      const tag = await textLayer(tagLabel, spec.tag.text, k)
      cursor -= tag.height
      const tagLeft = (W - tag.width) / 2
      await addText(tagLabel, spec.tag.text, tag, tagLeft, cursor)
      // gold rules either side
      const [rw, rh] = spec.tag.rule
      const ruleY = Math.round(cursor + tag.height / 2 - (rh * k) / 2)
      layers.push({ input: rectSvg(rw * k, rh * k, COLORS.gold), left: Math.round(tagLeft - (spec.tag.gap + rw) * k), top: ruleY })
      layers.push({ input: rectSvg(rw * k, rh * k, COLORS.gold), left: Math.round(tagLeft + tag.width + spec.tag.gap * k), top: ruleY })
    }
  }

  if (spec.kind === 'bar') {
    // Bottom gradient block sized to its content
    const [padT, padX, padB] = spec.pad
    const eventText = await textLayer(info.eventLabel, spec.eventRow.text, k)
    const time = info.timeLabel ? await textLayer(info.timeLabel, spec.timeRow.time, k) : null
    const tag  = tagLabel ? await textLayer(tagLabel, spec.timeRow.tag, k) : null

    // Second row holds the time and/or the tag — the tag renders even with no
    // time (matching FinishPreview, which shows them independently)
    const rowH    = Math.max(spec.eventRow.tile * k, eventText.height)
    const row2H   = Math.max(time?.height ?? 0, tag?.height ?? 0)
    const blockH  = padT * k + rowH
      + (row2H > 0 ? spec.timeRow.marginTop * k + row2H : 0)
      + padB * k
    layers.push({ input: scrimSvg(spec.scrim, W, Math.round(blockH)), left: 0, top: Math.round(H - blockH) })

    let y = H - blockH + padT * k
    // event row: gold flag tile + event label
    layers.push({ input: flagTileSvg(spec.eventRow.tile * k, spec.eventRow.tileRadius * k, COLORS.gold, COLORS.ink), left: Math.round(padX * k), top: Math.round(y + (rowH - spec.eventRow.tile * k) / 2) })
    await addText(info.eventLabel, spec.eventRow.text, eventText, padX * k + (spec.eventRow.tile + spec.eventRow.gap) * k, y + (rowH - eventText.height) / 2)
    y += rowH + spec.timeRow.marginTop * k

    if (time) {
      await addText(info.timeLabel!, spec.timeRow.time, time, padX * k, y)
    }
    if (tag) {
      // after the time (baseline-ish aligned), or alone at the left edge
      const tagLeft = time ? padX * k + time.width + spec.timeRow.gap * k : padX * k
      const tagTop  = time ? y + time.height - tag.height - 4 * k : y
      await addText(tagLabel!, spec.timeRow.tag, tag, tagLeft, tagTop)
    }

    // Brand, top-right: blue tile + wordmark
    const b = spec.brand
    const brandText = await textLayer('FinishPics', b.text, k)
    const brandW = b.tile * k + 5 * k + brandText.width
    const bx = W - b.offset * k - brandW
    layers.push({ input: flagTileSvg(b.tile * k, b.tileRadius * k, COLORS.blue, COLORS.white), left: Math.round(bx), top: Math.round(b.offset * k) })
    await addText('FinishPics', b.text, brandText, bx + b.tile * k + 5 * k, b.offset * k + (b.tile * k - brandText.height) / 2)
  }

  if (spec.kind === 'bigtime') {
    layers.push({ input: scrimSvg(spec.scrim, W, H), left: 0, top: 0 })

    // Bottom-centered stack (bottom-up: nameLine, time, tag pill)
    let cursor = H - spec.bottom * k

    const nameLine = await textLayer(`${info.name} · ${info.eventLabel}`, spec.nameLine, k)
    cursor -= nameLine.height
    await addText(`${info.name} · ${info.eventLabel}`, spec.nameLine, nameLine, (W - nameLine.width) / 2, cursor)
    cursor -= spec.nameLine.marginTop * k

    if (info.timeLabel) {
      const time = await textLayer(info.timeLabel, spec.time, k)
      cursor -= time.height
      await addText(info.timeLabel!, spec.time, time, (W - time.width) / 2, cursor)
      cursor -= spec.time.marginTop * k
    }

    if (tagLabel) {
      const tagText = await textLayer(tagLabel, spec.tagPill.text, k)
      const pillW = tagText.width + spec.tagPill.padX * 2 * k
      const pillH = tagText.height + spec.tagPill.padY * 2 * k
      cursor -= pillH
      const px0 = (W - pillW) / 2
      layers.push({ input: pillSvg(pillW, pillH, COLORS.gold), left: Math.round(px0), top: Math.round(cursor) })
      layers.push({ input: tagText.data, left: Math.round(px0 + spec.tagPill.padX * k), top: Math.round(cursor + spec.tagPill.padY * k) })
    }
  }

  if (opts.watermark) {
    layers.push({ input: watermarkSvg(W, H, k), left: 0, top: 0 })
  }

  return sharp(photo).composite(layers).jpeg({ quality: 92 }).toBuffer()
}

// ---------------------------------------------------------------------------
// Formatted finish card — the "Your finish image" hero + the Photo/Full
// bundles' formatted deliverable. The full-width photo with a bottom gradient
// band: name + team (left), gold time + "Captured by" credit (right), a
// divider, and an event · meet · venue footer. (New-style replacement for the
// v1 navy info-strip in formatted-image.ts.)
// ---------------------------------------------------------------------------

const CARD_W = 1600

/** Render `text`; if wider than maxW, re-render scaled down to fit. */
async function fitText(text: string, spec: TextSpec, maxW: number): Promise<RenderedText> {
  const first = await textLayer(text, spec, 1)
  if (first.width <= maxW || first.width === 0) return first
  return textLayer(text, { ...spec, size: spec.size * (maxW / first.width) }, 1)
}

export async function renderFinishCard(
  source: Buffer,
  info:   SocialRenderInfo,
  opts:   { watermark?: boolean } = {},
): Promise<Buffer> {
  const base = sharp(source).resize({ width: CARD_W, withoutEnlargement: true })
  const photo = await base.jpeg({ quality: 92 }).toBuffer()
  const meta = await sharp(photo).metadata()
  const W = meta.width!, H = meta.height!
  const padX = W * 0.05
  const padB = W * 0.045
  const white85 = 'rgba(255,255,255,0.85)'

  const nameSpec:   TextSpec = { size: W * 0.044,  weight: 800, italic: true, uppercase: true, color: COLORS.white, shadow: 'x' }
  const teamSpec:   TextSpec = { size: W * 0.019,  weight: 600, color: white85 }
  const timeSpec:   TextSpec = { size: W * 0.075,  weight: 800, italic: true, color: COLORS.gold, shadow: 'x' }
  const creditSpec: TextSpec = { size: W * 0.015,  weight: 700, uppercase: true, tracking: 0.06, color: 'rgba(255,255,255,0.8)' }
  const footSpec:   TextSpec = { size: W * 0.0165, weight: 600, uppercase: true, tracking: 0.04, color: 'rgba(255,255,255,0.72)' }

  const timer  = (info.companyName ?? 'In Stride Timing')
  const footer = [info.eventLabel, info.meetName, info.venue].filter(Boolean).join('   ·   ')

  // Render pieces (name + footer shrink to fit their columns)
  const time   = info.timeLabel ? await textLayer(info.timeLabel, timeSpec, 1) : null
  const credit = await textLayer(`Captured by ${timer}`, creditSpec, 1)
  const timeColW = Math.max(time?.width ?? 0, credit.width)
  const name = await fitText(info.name, nameSpec, W - padX * 2 - timeColW - W * 0.045)
  const team = info.team && info.team !== info.name ? await textLayer(info.team, teamSpec, 1) : null
  const foot = await fitText(footer, footSpec, W - padX * 2)

  const layers: Layer[] = []
  const gap = W * 0.02

  // bottom-up: footer, divider, then the name/team ↔ time/credit row
  const footTop = H - padB - foot.height
  const divY    = Math.round(footTop - gap)
  const divH    = Math.max(1, Math.round(W * 0.0011))

  const creditTop = divY - gap - credit.height
  const timeTop   = time ? creditTop - W * 0.004 - time.height : creditTop
  const teamTop   = divY - gap - (team?.height ?? 0)
  const nameTop   = teamTop - W * 0.006 - name.height
  const bandTop   = Math.round(Math.min(nameTop, timeTop) - padX * 0.6)

  // gradient band
  layers.push({
    input: scrimSvg(
      'linear-gradient(180deg, rgba(8,16,34,0) 0%, rgba(8,16,34,0.9) 24%, rgba(8,16,34,0.98) 100%)',
      W, H - bandTop,
    ),
    left: 0, top: bandTop,
  })

  const place = async (t: RenderedText, spec: TextSpec, text: string, left: number, top: number) => {
    if (spec.shadow) layers.push({ input: await shadowLayer(text, spec, 1), left: Math.round(left), top: Math.round(top + W * 0.0016) })
    layers.push({ input: t.data, left: Math.round(left), top: Math.round(top) })
  }

  // right column: time + credit (right-aligned)
  if (time) await place(time, timeSpec, info.timeLabel!, W - padX - time.width, timeTop)
  await place(credit, creditSpec, `Captured by ${timer}`, W - padX - credit.width, creditTop)
  // left column: name + team
  await place(name, nameSpec, info.name, padX, nameTop)
  if (team) await place(team, teamSpec, info.team!, padX, teamTop)
  // divider + footer
  layers.push({ input: rectSvg(W - padX * 2, divH, 'rgba(255,255,255,0.2)'), left: Math.round(padX), top: divY })
  await place(foot, footSpec, footer, padX, footTop)

  if (opts.watermark) {
    layers.push({ input: watermarkSvg(W, H, W / BASE_W), left: 0, top: 0 })
  }

  return sharp(photo).composite(layers).jpeg({ quality: 90 }).toBuffer()
}
