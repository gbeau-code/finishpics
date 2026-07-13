/**
 * cart.ts — client-side cart model + localStorage persistence
 *
 * The cart lives entirely in the browser until checkout: on "Pay", the lines
 * are POSTed to /api/checkout which re-prices them server-side (BUNDLES) and
 * creates the pending order + Stripe session (see lib/orders.ts).
 */

import type { Bundle } from './bundles'
import { BUNDLES } from './bundles'
import type { LineConfig } from './graphic-spec'

/** Display metadata captured at add-time so the cart renders without refetching. */
export interface CartLineDisplay {
  name:       string
  team:       string | null
  eventLabel: string
  meetName:   string
  timeLabel:  string | null
}

export interface CartLine {
  lineId:    string
  athleteId: string
  bundle:    Bundle
  config:    LineConfig
  display:   CartLineDisplay
  addedAt:   number
}

export function cartTotalCents(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + BUNDLES[l.bundle].cents, 0)
}

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'fp-cart-v1'

export function loadCart(): CartLine[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as CartLine[]) : []
  } catch {
    return []
  }
}

export function saveCart(lines: CartLine[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
  } catch {
    // storage full / private mode — cart just won't persist across reloads
  }
}
