/**
 * cart.ts — client-side cart model + localStorage persistence
 *
 * The cart lives entirely in the browser until checkout: on "Pay", the lines
 * are POSTed to /api/checkout which re-prices them server-side (BUNDLES) and
 * creates the pending order + Stripe session (see lib/orders.ts).
 */

import type { Bundle } from './bundles'
import { BUNDLES, isBundle } from './bundles'
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

/** Shape-check one stored line — stale/foreign entries must not crash the UI. */
function isValidLine(x: unknown): x is CartLine {
  if (typeof x !== 'object' || x === null) return false
  const l = x as Record<string, unknown>
  return (
    typeof l.lineId === 'string' &&
    typeof l.athleteId === 'string' &&
    isBundle(l.bundle) &&
    typeof l.config === 'object' && l.config !== null &&
    typeof l.display === 'object' && l.display !== null &&
    typeof (l.display as Record<string, unknown>).name === 'string'
  )
}

export function loadCart(): CartLine[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isValidLine) : []
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

// ---------------------------------------------------------------------------
// Checkout-pending marker
//
// Set right before redirecting to Stripe; consumed by the order-confirmation
// page so it only clears the cart when the visit is the RETURN from that
// checkout — revisiting an old confirmation link (it doubles as the permanent
// download hub) must not wipe a newly built cart.
// ---------------------------------------------------------------------------

const PENDING_KEY = 'fp-checkout-pending'
const PENDING_TTL_MS = 2 * 60 * 60 * 1000   // checkout sessions go stale well within 2h

export function markCheckoutPending(): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(PENDING_KEY, String(Date.now())) } catch {}
}

/** True (and clears the marker) if a checkout was started recently. */
export function consumeCheckoutPending(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = window.localStorage.getItem(PENDING_KEY)
    if (!raw) return false
    window.localStorage.removeItem(PENDING_KEY)
    return Date.now() - Number(raw) < PENDING_TTL_MS
  } catch {
    return false
  }
}
