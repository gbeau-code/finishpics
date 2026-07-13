/**
 * graphic-spec.ts — the shared declarative layout spec for social graphics
 *
 * THE parity contract of v2: the client-side live preview (FinishPreview,
 * canvas/CSS) and the server-side Sharp renderer both consume THIS spec, so
 * what the customer sees is pixel-identical to the file they download.
 *
 * All positions/sizes are expressed as fractions of the OUTPUT dimensions
 * (0–1), never absolute pixels, so one spec drives a 400px preview and a
 * 1080px deliverable alike.
 *
 * Templates/formats from the prototype (design/handoff/README.md):
 *   formats:   post (1080×1080) · story (1080×1920)
 *   templates: whitegold · bar · bigtime
 *   tags:      none · pb ("Personal Best") · sb ("Season Best")
 *
 * NOTE(P3): the numeric values below are a first pass; refine them against
 * the prototype (design/handoff/FinishPreview.dc.html) when building the
 * FinishPreview component and pixel-diff preview vs. Sharp output.
 */

// ---------------------------------------------------------------------------
// Config carried on every cart line / order item (stored as jsonb)
// ---------------------------------------------------------------------------

export type GraphicFormat   = 'post' | 'story'
export type GraphicTemplate = 'whitegold' | 'bar' | 'bigtime'
export type GraphicTag      = 'none' | 'pb' | 'sb'

/** Focal point for background-cover cropping, 0–100 (%) on each axis. */
export interface FocalPoint { x: number; y: number }

/** One styled social graphic (a bundle may include several). */
export interface SocialGraphicConfig {
  format:   GraphicFormat
  template: GraphicTemplate
  tag:      GraphicTag
  focal:    FocalPoint
}

/** Full per-line styling config persisted on order_items.config. */
export interface LineConfig {
  socials: SocialGraphicConfig[]
  caption?: string
}

export const DEFAULT_FOCAL: FocalPoint = { x: 50, y: 42 }

export const DEFAULT_SOCIAL: SocialGraphicConfig = {
  format: 'post', template: 'whitegold', tag: 'none', focal: DEFAULT_FOCAL,
}

export const FORMAT_DIMENSIONS: Record<GraphicFormat, { w: number; h: number }> = {
  post:  { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
}

export const TAG_LABELS: Record<GraphicTag, string | null> = {
  none: null,
  pb:   'PERSONAL BEST',
  sb:   'SEASON BEST',
}

// ---------------------------------------------------------------------------
// Validation (order_items.config comes back from the DB / client untrusted)
// ---------------------------------------------------------------------------

const FORMATS:   GraphicFormat[]   = ['post', 'story']
const TEMPLATES: GraphicTemplate[] = ['whitegold', 'bar', 'bigtime']
const TAGS:      GraphicTag[]      = ['none', 'pb', 'sb']

function clampPct(n: unknown): number {
  const x = typeof n === 'number' && Number.isFinite(n) ? n : 50
  return Math.max(0, Math.min(100, x))
}

/** Coerce untrusted input into a safe SocialGraphicConfig. */
export function sanitizeSocial(input: unknown): SocialGraphicConfig {
  const o = (input ?? {}) as Record<string, unknown>
  const focal = (o.focal ?? {}) as Record<string, unknown>
  return {
    format:   FORMATS.includes(o.format as GraphicFormat)       ? o.format   as GraphicFormat   : 'post',
    template: TEMPLATES.includes(o.template as GraphicTemplate) ? o.template as GraphicTemplate : 'whitegold',
    tag:      TAGS.includes(o.tag as GraphicTag)                ? o.tag      as GraphicTag      : 'none',
    focal:    { x: clampPct(focal.x), y: clampPct(focal.y) },
  }
}

/** Coerce untrusted input into a safe LineConfig. */
export function sanitizeLineConfig(input: unknown, maxSocials: number): LineConfig {
  const o = (input ?? {}) as Record<string, unknown>
  const socials = Array.isArray(o.socials) ? o.socials.slice(0, maxSocials).map(sanitizeSocial) : []
  const caption = typeof o.caption === 'string' ? o.caption.slice(0, 2000) : undefined
  return { socials, caption }
}

// ---------------------------------------------------------------------------
// Layout spec — consumed by BOTH the client preview and the Sharp renderer
//
// All numeric values are PIXELS AT BASE_W (the prototype's 360px-wide feed
// preview, extracted verbatim from design/handoff/FinishPreview.dc.html).
// Consumers scale linearly: px * (outputWidth / BASE_W). A 1080px deliverable
// is exactly 3× the 360px preview, so preview and download stay pixel-locked.
// ---------------------------------------------------------------------------

export const BASE_W = 360

export const COLORS = {
  gold:  '#FDB927',
  navy:  '#0A1B3D',
  blue:  '#0E63E6',
  white: '#ffffff',
  ink:   '#151515',
} as const

export interface TextSpec {
  /** Font size in px at BASE_W. */
  size: number
  weight: 400 | 600 | 700 | 800
  italic?: boolean
  uppercase?: boolean
  color: string
  /** Letter-spacing in em. */
  tracking?: number
  /** Line-height multiplier. */
  lineHeight?: number
  /** CSS text-shadow (preview); server renders an equivalent blur layer. */
  shadow?: string
}

export interface WhitegoldSpec {
  kind: 'whitegold'
  /** Full-frame scrim gradient (CSS string; server mirrors with SVG stops). */
  scrim: string
  brand: { offset: number; tile: number; tileRadius: number; text: TextSpec }
  /** Bottom-centered block: [padTop, padX, padBottom] at BASE_W. */
  pad: [number, number, number]
  tag:  { rule: [number, number]; gap: number; marginBottom: number; text: TextSpec }
  time: TextSpec
  nameLine: TextSpec & { marginTop: number }
  meetLine: TextSpec & { marginTop: number }
}

export interface BarSpec {
  kind: 'bar'
  /** Bottom block padding [top, x, bottom] and its gradient background. */
  pad: [number, number, number]
  scrim: string
  eventRow: { tile: number; tileRadius: number; gap: number; text: TextSpec }
  timeRow:  { marginTop: number; gap: number; time: TextSpec; tag: TextSpec }
  brand: { offset: number; tile: number; tileRadius: number; text: TextSpec }
}

export interface BigtimeSpec {
  kind: 'bigtime'
  scrim: string
  /** Bottom-centered block: bottom offset + x padding. */
  bottom: number
  padX: number
  tagPill: { padY: number; padX: number; text: TextSpec }
  time: TextSpec & { marginTop: number }
  nameLine: TextSpec & { marginTop: number }
}

export type TemplateSpec = WhitegoldSpec | BarSpec | BigtimeSpec

const { gold, navy, blue, white, ink } = COLORS

export const TEMPLATE_SPECS: Record<GraphicTemplate, TemplateSpec> = {
  // White & Gold — centered hero time over a top+bottom scrim
  whitegold: {
    kind: 'whitegold',
    scrim: 'linear-gradient(180deg, rgba(6,10,18,0.40) 0%, rgba(6,10,18,0) 24%, rgba(6,10,18,0) 38%, rgba(6,10,18,0.55) 64%, rgba(6,10,18,0.90) 100%)',
    brand: {
      offset: 16, tile: 16, tileRadius: 5,
      text: { size: 11, weight: 800, uppercase: true, tracking: 0.16, color: white, shadow: '0 1px 6px rgba(0,0,0,0.7)' },
    },
    pad: [34, 20, 24],
    tag: {
      rule: [22, 2], gap: 10, marginBottom: 11,
      text: { size: 12, weight: 800, uppercase: true, tracking: 0.22, color: gold, shadow: '0 1px 8px rgba(0,0,0,0.85)' },
    },
    time: { size: 64, weight: 800, italic: true, color: white, tracking: -0.02, lineHeight: 0.84, shadow: '0 4px 22px rgba(0,0,0,0.8)' },
    nameLine: { size: 12, weight: 800, uppercase: true, tracking: 0.18, color: white, marginTop: 13, shadow: '0 1px 8px rgba(0,0,0,0.7)' },
    meetLine: { size: 11, weight: 700, uppercase: true, tracking: 0.16, color: gold, marginTop: 5, shadow: '0 1px 8px rgba(0,0,0,0.85)' },
  },
  // Result Bar — navy gradient bar along the bottom, brand top-right
  bar: {
    kind: 'bar',
    pad: [30, 18, 16],
    scrim: 'linear-gradient(180deg, rgba(10,27,61,0) 0%, rgba(10,27,61,0.88) 78%)',
    eventRow: {
      tile: 18, tileRadius: 5, gap: 8,
      text: { size: 11, weight: 700, uppercase: true, tracking: 0.12, color: white },
    },
    timeRow: {
      marginTop: 7, gap: 9,
      time: { size: 40, weight: 800, color: white, tracking: -0.02, lineHeight: 1 },
      tag:  { size: 13, weight: 700, uppercase: true, tracking: 0.04, color: gold },
    },
    brand: {
      offset: 14, tile: 14, tileRadius: 4,
      text: { size: 11, weight: 700, color: white, shadow: '0 1px 3px rgba(0,0,0,0.5)' },
    },
  },
  // Big Time — huge centered time low on the frame
  bigtime: {
    kind: 'bigtime',
    scrim: 'linear-gradient(180deg, rgba(10,27,61,0.05) 30%, rgba(10,27,61,0.82) 100%)',
    bottom: 26,
    padX: 16,
    tagPill: {
      padY: 4, padX: 10,
      text: { size: 11, weight: 800, uppercase: true, tracking: 0.10, color: ink },
    },
    time: { size: 72, weight: 800, color: white, tracking: -0.03, lineHeight: 0.9, marginTop: 8, shadow: '0 6px 24px rgba(0,0,0,0.4)' },
    nameLine: { size: 12, weight: 600, uppercase: true, tracking: 0.14, color: 'rgba(255,255,255,0.92)', marginTop: 8 },
  },
}
