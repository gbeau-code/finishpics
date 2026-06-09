/**
 * purchases.ts — FinishPics purchase / payment records (Neon Postgres)
 *
 * One row per successful Stripe Checkout session.
 * Token used for download gating = stripe_session_id (cs_xxx…)
 */

import { neon } from '@neondatabase/serverless'
import crypto from 'crypto'
import type { Tier } from './stripe'

function getDb() {
  return neon(process.env.DATABASE_URL!)
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PurchaseStatus = 'pending' | 'paid'

export interface Purchase {
  id:                        string
  athlete_id:                string
  tier:                      Tier
  stripe_session_id:         string
  stripe_payment_intent_id:  string | null
  email:                     string | null
  amount_cents:              number
  status:                    PurchaseStatus
  created_at:                string
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Insert a pending purchase row before redirecting to Stripe Checkout. */
export async function createPurchase(data: {
  athlete_id:       string
  tier:             Tier
  stripe_session_id: string
  amount_cents:     number
}): Promise<Purchase> {
  const sql = getDb()
  const id         = crypto.randomUUID()
  const created_at = new Date().toISOString()

  const rows = await sql`
    INSERT INTO purchases
      (id, athlete_id, tier, stripe_session_id, amount_cents, status, created_at)
    VALUES
      (${id}, ${data.athlete_id}, ${data.tier}, ${data.stripe_session_id},
       ${data.amount_cents}, 'pending', ${created_at})
    ON CONFLICT (stripe_session_id) DO NOTHING
    RETURNING *
  `
  // If ON CONFLICT hit (duplicate call), fetch the existing row
  if (!rows.length) {
    const existing = await sql`
      SELECT * FROM purchases WHERE stripe_session_id = ${data.stripe_session_id} LIMIT 1
    `
    return existing[0] as Purchase
  }
  return rows[0] as Purchase
}

/** Mark a purchase as paid (called from webhook and success-page reconciliation). */
export async function confirmPurchase(
  stripeSessionId:        string,
  stripePaymentIntentId:  string | null,
  email:                  string | null,
): Promise<void> {
  const sql = getDb()
  await sql`
    UPDATE purchases
    SET status                    = 'paid',
        stripe_payment_intent_id  = ${stripePaymentIntentId},
        email                     = ${email}
    WHERE stripe_session_id = ${stripeSessionId}
      AND status = 'pending'
  `
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

// Tier rank — higher number = more access
const TIER_RANK: Record<Tier, number> = { basic: 0, enhanced: 1, full: 2 }

/**
 * Verify that a request token (Stripe session ID) grants the required tier
 * for a given athlete.  Returns the purchase if valid, null if not.
 *
 * Tier hierarchy:  basic (0) < enhanced (1) < full (2)
 * A 'full' purchase satisfies any minTier requirement.
 */
export async function requirePurchase(
  token:     string | null,
  athleteId: string,
  minTier:   Tier = 'basic',
): Promise<Purchase | null> {
  if (!token) return null
  const purchase = await getPurchaseBySession(token, athleteId)
  if (!purchase) return null
  if (TIER_RANK[purchase.tier] < TIER_RANK[minTier]) return null
  return purchase
}

/** Look up a confirmed purchase by Stripe session ID (and optionally athlete). */
export async function getPurchaseBySession(
  stripeSessionId: string,
  athleteId?:      string,
): Promise<Purchase | null> {
  const sql = getDb()
  const rows = athleteId
    ? await sql`
        SELECT * FROM purchases
        WHERE stripe_session_id = ${stripeSessionId}
          AND athlete_id        = ${athleteId}
          AND status            = 'paid'
        LIMIT 1
      `
    : await sql`
        SELECT * FROM purchases
        WHERE stripe_session_id = ${stripeSessionId}
          AND status            = 'paid'
        LIMIT 1
      `
  return rows.length ? (rows[0] as Purchase) : null
}
