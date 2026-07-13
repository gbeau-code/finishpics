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
// ---------------------------------------------------------------------------

/** A positioned text element. All values are fractions of output W/H. */
export interface TextSpec {
  /** Fraction of output width for the font size (e.g. 0.06 → 65px at 1080). */
  size: number
  weight: 400 | 700 | 800
  italic?: boolean
  uppercase?: boolean
  color: string
  /** Letter-spacing in em. */
  tracking?: number
  /** Use tabular numerals (times/places/prices). */
  tnum?: boolean
}

export interface TemplateSpec {
  /** Bottom overlay panel height as a fraction of output height (0 = none). */
  panelHeight: number
  /** Panel fill — solid color or gradient descriptor. */
  panelFill: string
  /** Inset padding as fraction of output width. */
  pad: number
  name:   TextSpec
  team:   TextSpec
  time:   TextSpec
  /** "event · meet · venue" credit line. */
  credit: TextSpec
  /** Tag chip (PB/SB) styling; rendered only when tag !== 'none'. */
  tagChip: { bg: string; color: string; text: TextSpec }
}

const GOLD  = '#FDB927'
const NAVY  = '#0A1B3D'
const WHITE = '#ffffff'
const INK   = '#151515'

/**
 * First-pass template specs (refine in P3 against the prototype).
 * Story format uses the same specs; vertical placement scales with panelHeight
 * being a fraction of the (taller) output.
 */
export const TEMPLATE_SPECS: Record<GraphicTemplate, TemplateSpec> = {
  // White & gold: white bottom panel, navy name, big gold time
  whitegold: {
    panelHeight: 0.24,
    panelFill:   WHITE,
    pad:         0.055,
    name:   { size: 0.052, weight: 800, italic: true, uppercase: true, color: NAVY, tracking: -0.02 },
    team:   { size: 0.026, weight: 700, uppercase: true, color: '#5b6270', tracking: 0.08 },
    time:   { size: 0.085, weight: 800, italic: true, color: GOLD, tnum: true, tracking: -0.02 },
    credit: { size: 0.020, weight: 400, color: '#9aa1ab' },
    tagChip: {
      bg: GOLD, color: INK,
      text: { size: 0.020, weight: 800, italic: true, uppercase: true, color: INK, tracking: 0.14 },
    },
  },
  // Result bar: slim navy bar across the bottom, all content on one line
  bar: {
    panelHeight: 0.13,
    panelFill:   NAVY,
    pad:         0.045,
    name:   { size: 0.038, weight: 800, italic: true, uppercase: true, color: WHITE, tracking: -0.01 },
    team:   { size: 0.022, weight: 700, uppercase: true, color: 'rgba(255,255,255,0.75)', tracking: 0.08 },
    time:   { size: 0.055, weight: 800, italic: true, color: GOLD, tnum: true },
    credit: { size: 0.018, weight: 400, color: 'rgba(255,255,255,0.5)' },
    tagChip: {
      bg: GOLD, color: INK,
      text: { size: 0.018, weight: 800, italic: true, uppercase: true, color: INK, tracking: 0.14 },
    },
  },
  // Big time: minimal chrome, huge gold time over the photo, small credit
  bigtime: {
    panelHeight: 0,
    panelFill:   'linear-gradient(transparent, rgba(10,27,61,0.85))', // photo-bottom scrim
    pad:         0.055,
    name:   { size: 0.042, weight: 800, italic: true, uppercase: true, color: WHITE, tracking: -0.01 },
    team:   { size: 0.022, weight: 700, uppercase: true, color: 'rgba(255,255,255,0.75)', tracking: 0.08 },
    time:   { size: 0.14,  weight: 800, italic: true, color: GOLD, tnum: true, tracking: -0.02 },
    credit: { size: 0.018, weight: 400, color: 'rgba(255,255,255,0.6)' },
    tagChip: {
      bg: GOLD, color: INK,
      text: { size: 0.018, weight: 800, italic: true, uppercase: true, color: INK, tracking: 0.14 },
    },
  },
}
