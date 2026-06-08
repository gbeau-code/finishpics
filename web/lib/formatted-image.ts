import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { formatTime, formatRound } from './format'

// Load fonts once and cache them as base64 for SVG embedding
let _fontRegularB64: string | null = null
let _fontBoldB64: string | null = null

function getFontBase64(variant: 'Regular' | 'Bold'): string {
  if (variant === 'Bold') {
    if (!_fontBoldB64) {
      const p = path.join(process.cwd(), 'public', 'fonts', 'RobotoCondensed-Bold.ttf')
      _fontBoldB64 = fs.readFileSync(p).toString('base64')
    }
    return _fontBoldB64
  }
  if (!_fontRegularB64) {
    const p = path.join(process.cwd(), 'public', 'fonts', 'RobotoCondensed-Regular.ttf')
    _fontRegularB64 = fs.readFileSync(p).toString('base64')
  }
  return _fontRegularB64
}

export interface FormattedImageOptions {
  firstName: string
  lastName: string
  bib: string
  team: string | null
  place: number | null        // kept for API compat; no longer shown in strip
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

const STRIP_H = 170

// In Stride Timing brand colours
const BRAND_BLUE  = '#0C7FEA'
const BRAND_NAVY  = '#0B0D2E'   // slightly darker than logo navy for strip bg

function escapeXml(s: string): string {
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

function buildSvgStrip(width: number, opts: FormattedImageOptions): string {
  const {
    firstName, lastName, bib, team, finishTime,
    eventName, eventNum, round, heatNum, meetName, meetDate, meetLocation,
    companyName,
  } = opts

  const W          = width
  const fullName   = escapeXml(`${firstName} ${lastName}`)
  const timeLabel  = finishTime != null ? escapeXml(formatTime(finishTime)) : ''
  const eventLabel = escapeXml(
    eventName
      ? `${eventName}  ·  Heat ${heatNum}`
      : `Event ${eventNum}  ·  Heat ${heatNum}`
  )

  // Affiliation line: team and/or bib
  const hasBib  = bib && bib !== '0'
  const affParts: string[] = []
  if (team) affParts.push(escapeXml(team))
  if (hasBib) affParts.push(escapeXml(`Bib #${bib}`))
  const affLabel = affParts.join('  ·  ')

  // Meet line: name · location · date
  const meetParts: string[] = [escapeXml(meetName)]
  if (meetLocation) meetParts.push(escapeXml(meetLocation))
  meetParts.push(escapeXml(meetDateLabel(meetDate)))
  const meetLabel = meetParts.join('  ·  ')

  const capturedByName = companyName
    ? escapeXml(companyName.toUpperCase())
    : 'IN STRIDE TIMING'

  const fontRegB64  = getFontBase64('Regular')
  const fontBoldB64 = getFontBase64('Bold')

  return `<svg width="${W}" height="${STRIP_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @font-face {
        font-family: 'RobotoCondensed';
        font-weight: normal;
        src: url('data:font/truetype;base64,${fontRegB64}') format('truetype');
      }
      @font-face {
        font-family: 'RobotoCondensed';
        font-weight: bold;
        src: url('data:font/truetype;base64,${fontBoldB64}') format('truetype');
      }
    </style>
  </defs>

  <!-- background -->
  <rect width="${W}" height="${STRIP_H}" fill="${BRAND_NAVY}"/>

  <!-- accent bar top -->
  <rect width="${W}" height="4" fill="${BRAND_BLUE}"/>

  <!-- accent bar bottom -->
  <rect y="${STRIP_H - 4}" width="${W}" height="4" fill="${BRAND_BLUE}"/>

  <!-- left accent stripe -->
  <rect x="0" y="4" width="4" height="${STRIP_H - 8}" fill="${BRAND_BLUE}" opacity="0.7"/>

  <!-- right accent stripe -->
  <rect x="${W - 4}" y="4" width="4" height="${STRIP_H - 8}" fill="${BRAND_BLUE}" opacity="0.7"/>

  <!-- captured by (top-right) -->
  <text x="${W - 20}" y="38" font-family="RobotoCondensed" font-size="12" text-anchor="end">
    <tspan fill="#3D6080">Captured by&#160;</tspan><tspan font-weight="bold" fill="${BRAND_BLUE}">${capturedByName}</tspan>
  </text>

  <!-- athlete name -->
  <text x="24" y="56" font-family="RobotoCondensed" font-size="30" font-weight="bold"
        fill="white" letter-spacing="0.3">${fullName}</text>

  <!-- affiliation (team · bib) -->
  ${affLabel ? `<text x="24" y="80" font-family="RobotoCondensed" font-size="16" fill="#7EB8F7">${affLabel}</text>` : ''}

  <!-- event line -->
  <text x="24" y="104" font-family="RobotoCondensed" font-size="15" fill="#5B8AB5">${eventLabel}</text>

  <!-- meet line -->
  <text x="24" y="130" font-family="RobotoCondensed" font-size="14" fill="#4A7090">${meetLabel}</text>

  <!-- finish time (right, monospace) -->
  ${timeLabel ? `
  <text x="${W - 20}" y="114" font-family="RobotoCondensed" font-size="34"
        font-weight="bold" fill="white" text-anchor="end">${timeLabel}</text>` : ''}

</svg>`
}

export async function createFormattedImage(
  rawBuffer: Buffer,
  opts: FormattedImageOptions,
): Promise<Buffer> {
  const meta   = await sharp(rawBuffer).metadata()
  const width  = meta.width  ?? 800
  const height = meta.height ?? 300
  const totalH = height + STRIP_H

  const strip = Buffer.from(buildSvgStrip(width, opts))

  return sharp({
    create: { width, height: totalH, channels: 3, background: { r: 11, g: 13, b: 46 } },  // matches BRAND_NAVY
  })
    .composite([
      { input: rawBuffer, top: 0,      left: 0 },
      { input: strip,     top: height, left: 0 },
    ])
    .jpeg({ quality: 92 })
    .toBuffer()
}
