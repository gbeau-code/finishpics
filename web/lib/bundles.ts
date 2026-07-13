/**
 * bundles.ts — FinishPics v2 bundle model
 *
 * Replaces the v1 TIERS (basic/enhanced/full) for NEW sales. Legacy `purchases`
 * rows keep resolving through tierCapabilities() so old download links never
 * break (see resolveAccess in orders.ts).
 *
 * Prices/definitions from the design prototype (design/handoff/README.md §4):
 *   raw $5 · Photo $10 · Full $15 (incl. 1 post + 1 story) · Social $5
 */

import type { Tier } from './stripe'

// ---------------------------------------------------------------------------
// Capabilities — what a purchase unlocks, independent of how it was bought
// ---------------------------------------------------------------------------

export interface Capabilities {
  /** Clean hi-res photo download (no watermark, no overlay) */
  rawPhoto: boolean
  /** Formatted finish card (photo + info strip) */
  formatted: boolean
  /** Individual finish-line camera frames + boomerang GIF */
  frames: boolean
  /** Number of social graphics (post/story) included */
  socials: number
}

export const NO_ACCESS: Capabilities = {
  rawPhoto: false, formatted: false, frames: false, socials: 0,
}

// ---------------------------------------------------------------------------
// v2 bundles
// ---------------------------------------------------------------------------

export const BUNDLES = {
  raw: {
    cents:       500,
    label:       '$5',
    title:       'Raw',
    description: 'Hi-res photo, no overlay',
    caps: { rawPhoto: true, formatted: false, frames: false, socials: 0 } as Capabilities,
  },
  photosocial: {
    cents:       1000,
    label:       '$10',
    title:       'Photo',
    description: 'Raw + formatted finish image',
    caps: { rawPhoto: true, formatted: true, frames: false, socials: 0 } as Capabilities,
  },
  works: {
    cents:       1500,
    label:       '$15',
    title:       'Full',
    description: 'Photo + formatted + post & story',
    // frames: true keeps feature parity with the v1 full tier (finish-line
    // camera frames + boomerang), which the prototype doesn't model.
    caps: { rawPhoto: true, formatted: true, frames: true, socials: 2 } as Capabilities,
  },
  social: {
    cents:       500,
    label:       '$5',
    title:       'Social',
    description: 'One post + one story, no photo file',
    // SECURITY: social must NOT expose the clean photo download.
    caps: { rawPhoto: false, formatted: false, frames: false, socials: 2 } as Capabilities,
  },
} as const

export type Bundle = keyof typeof BUNDLES

export function isBundle(x: unknown): x is Bundle {
  return typeof x === 'string' && x in BUNDLES
}

// ---------------------------------------------------------------------------
// Legacy v1 tier → capabilities bridge
// ---------------------------------------------------------------------------

export function tierCapabilities(tier: Tier): Capabilities {
  switch (tier) {
    case 'basic':    return { rawPhoto: true, formatted: false, frames: false, socials: 0 }
    case 'enhanced': return { rawPhoto: true, formatted: true,  frames: false, socials: 0 }
    case 'full':     return { rawPhoto: true, formatted: true,  frames: true,  socials: 0 }
  }
}

/** Union two capability sets (a customer may hold multiple purchases). */
export function mergeCapabilities(a: Capabilities, b: Capabilities): Capabilities {
  return {
    rawPhoto:  a.rawPhoto  || b.rawPhoto,
    formatted: a.formatted || b.formatted,
    frames:    a.frames    || b.frames,
    socials:   Math.max(a.socials, b.socials),
  }
}
