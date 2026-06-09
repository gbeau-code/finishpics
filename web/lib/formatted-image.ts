import sharp from 'sharp'
import fs from 'fs'
import { formatTime } from './format'
import { ROBOTO_CONDENSED_BOLD_B64, ROBOTO_CONDENSED_REGULAR_B64 } from './font-data'

export interface FormattedImageOptions {
  firstName: string
  lastName: string
  bib: string
  team: string | null
  place: number | null
  finishTime: number | null
  eventName: string | null
  eventNum: string
  round: string
  heatNum: string
  meetName: string
  meetDate: string
  meetLocation?: string | null
  companyName?: string | null
}

// Strip height and font sizes scale with image width so the info bar
// looks proportional regardless of whether the image is 800px or 2000px wide.
const STRIP_BASE = 185   // strip height at BASE_WIDTH
const BASE_WIDTH = 800   // reference width
const BRAND_BLUE = '#0C7FEA'
const BRAND_NAVY = '#0B0D2E'

/** Scale factor: 1.0 at 800px wide, 2.0 at 1600px, clamped to [0.8, 3.0] */
function sc(width: number): number {
  return Math.max(0.8, Math.min(3.0, width / BASE_WIDTH))
}
function px(base: number, width: number): number {
  return Math.round(base * sc(width))
}

// ---------------------------------------------------------------------------
// Font bootstrap — write TTFs to /tmp once per Lambda instance
// ---------------------------------------------------------------------------

let _fontsReady = false
function ensureFonts(): { bold: string; regular: string } {
  const bold    = '/tmp/FP-Bold.ttf'
  const regular = '/tmp/FP-Regular.ttf'
  if (!_fontsReady) {
    if (!fs.existsSync(bold))
      fs.writeFileSync(bold, Buffer.from(ROBOTO_CONDENSED_BOLD_B64, 'base64'))
    if (!fs.existsSync(regular))
      fs.writeFileSync(regular, Buffer.from(ROBOTO_CONDENSED_REGULAR_B64, 'base64'))
    _fontsReady = true
  }
  return { bold, regular }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function meetDateLabel(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

/** Render a single line of text via Pango (sharp text input) → transparent PNG buffer */
async function textPng(
  text: string,
  fontfile: string,
  ptSize: number,
  color: string,
  maxWidth: number,
): Promise<Buffer> {
  const markup = `<span foreground="${color}" font_desc="${ptSize}">${esc(text)}</span>`
  return sharp({
    text: {
      text:     markup,
      fontfile,
      width:    maxWidth,
      rgba:     true,
      dpi:      96,
    },
  })
    .png()
    .toBuffer()
}

// ---------------------------------------------------------------------------
// Strip builder
// ---------------------------------------------------------------------------

async function buildStrip(width: number, opts: FormattedImageOptions): Promise<Buffer> {
  const { bold, regular } = ensureFonts()
  const H = px(STRIP_BASE, width)

  const {
    firstName, lastName, bib, team, finishTime,
    eventName, eventNum, heatNum, meetName, meetDate, meetLocation, companyName,
  } = opts

  const fullName    = `${firstName} ${lastName}`
  const hasBib      = bib && bib !== '0'
  const affParts: string[] = []
  if (team)   affParts.push(team)
  if (hasBib) affParts.push(`Bib #${bib}`)
  const affLabel    = affParts.join('  ·  ')

  const meetParts: string[] = [meetName]
  if (meetLocation) meetParts.push(meetLocation)
  meetParts.push(meetDateLabel(meetDate))
  const meetLabel   = meetParts.join('  ·  ')

  const eventLabel  = eventName
    ? `${eventName}  ·  Heat ${heatNum}`
    : `Event ${eventNum}  ·  Heat ${heatNum}`

  const capturedBy  = `Captured by  ${(companyName ?? 'IN STRIDE TIMING').toUpperCase()}`
  const timeLabel   = finishTime != null ? formatTime(finishTime) : ''

  // Background: navy rectangle + blue accent bars (SVG, no text)
  // All sizes and positions scale with image width
  const s = sc(width)
  const p = (base: number) => Math.round(base * s)

  const barPx    = Math.max(4, p(4))
  const dividerX = Math.floor(width * 0.62)
  const bgSvg = Buffer.from(
    `<svg width="${width}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${H}" fill="${BRAND_NAVY}"/>
      <rect width="${width}" height="${barPx}" fill="${BRAND_BLUE}"/>
      <rect y="${H - barPx}" width="${width}" height="${barPx}" fill="${BRAND_BLUE}"/>
      <rect x="0" y="${barPx}" width="${barPx}" height="${H - barPx * 2}" fill="${BRAND_BLUE}" opacity="0.7"/>
      <rect x="${width - barPx}" y="${barPx}" width="${barPx}" height="${H - barPx * 2}" fill="${BRAND_BLUE}" opacity="0.7"/>
      <rect x="${dividerX}" y="${p(20)}" width="${Math.max(1, p(1))}" height="${H - p(40)}" fill="${BRAND_BLUE}" opacity="0.35"/>
    </svg>`
  )

  // Build composites — text layers on top of background
  const composites: sharp.OverlayOptions[] = [
    { input: bgSvg, top: 0, left: 0 },
  ]

  const add = async (
    text: string, fontfile: string, ptSize: number,
    color: string, top: number, left: number, maxW: number,
  ) => {
    if (!text.trim()) return
    try {
      const buf = await textPng(text, fontfile, ptSize, color, maxW)
      composites.push({ input: buf, top, left })
    } catch { /* skip if text render fails */ }
  }

  const padL    = p(24)
  const padR    = p(16)
  const leftMax = Math.floor(width * 0.60)
  const rightMax = Math.floor(width * 0.34)
  const rightX  = width - padR - rightMax

  // Left column — 4 rows with deliberate vertical rhythm
  // Right column — company label + large finish time, vertically centered
  await Promise.all([
    add(fullName,   bold,    p(30), '#FFFFFF', p(20),  padL,   leftMax),
    add(affLabel,   regular, p(16), '#A8D0F8', p(62),  padL,   leftMax),
    add(eventLabel, regular, p(15), '#7FB8E8', p(88),  padL,   leftMax),
    add(meetLabel,  regular, p(14), '#6AAAD8', p(113), padL,   leftMax),
    add(capturedBy, regular, p(12), '#7FB8E8', p(22),  rightX, rightMax),
    ...(timeLabel ? [add(timeLabel, bold, p(38), '#FFFFFF', p(72), rightX, rightMax)] : []),
  ])

  return sharp({
    create: { width, height: H, channels: 4, background: { r: 11, g: 13, b: 46, alpha: 1 } },
  })
    .composite(composites)
    .png()
    .toBuffer()
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function createFormattedImage(
  rawBuffer: Buffer,
  opts: FormattedImageOptions,
): Promise<Buffer> {
  const meta   = await sharp(rawBuffer).metadata()
  const width  = meta.width  ?? 800
  const height = meta.height ?? 300

  const strip = await buildStrip(width, opts)

  // Use the strip's actual rendered height (scales with image width)
  const { height: stripH = px(STRIP_BASE, width) } = await sharp(strip).metadata()
  const totalH = height + stripH

  return sharp({
    create: { width, height: totalH, channels: 3, background: { r: 11, g: 13, b: 46 } },
  })
    .composite([
      { input: rawBuffer, top: 0,      left: 0 },
      { input: strip,     top: height, left: 0 },
    ])
    .jpeg({ quality: 92 })
    .toBuffer()
}
