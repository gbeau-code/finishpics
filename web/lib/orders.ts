/**
 * orders.ts — FinishPics v2 combined orders (multi-item cart)
 *
 * One row in `orders` per Stripe Checkout session; one row in `order_items`
 * per cart line (athlete × bundle × styling config).
 *
 * Access token for downloads = the order's stripe_session_id (cs_xxx…),
 * matching the legacy per-athlete convention in purchases.ts. The human-facing
 * order number (FP-####) is display-only, assigned on payment confirmation.
 *
 * IMPORTANT: this model is ADDITIVE. The legacy `purchases` table and its
 * gating stay untouched so pre-v2 download links keep working forever.
 * resolveAccess() below is the single place both worlds are unioned.
 */

import { neon } from '@neondatabase/serverless'
import crypto from 'crypto'
import { BUNDLES, tierCapabilities, mergeCapabilities, NO_ACCESS } from './bundles'
import type { Bundle, Capabilities } from './bundles'
import { sanitizeLineConfig } from './graphic-spec'
import type { LineConfig } from './graphic-spec'
import { getPurchaseBySession } from './purchases'

function getDb() {
  return neon(process.env.DATABASE_URL!)
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OrderStatus = 'pending' | 'paid'

export interface Order {
  id:                       string
  order_number:             string | null   // "FP-####", assigned when paid
  stripe_session_id:        string
  stripe_payment_intent_id: string | null
  email:                    string | null
  amount_cents:             number
  status:                   OrderStatus
  created_at:               string
}

export interface OrderItem {
  id:           string
  order_id:     string
  athlete_id:   string
  bundle:       Bundle
  config:       LineConfig | null
  amount_cents: number
  created_at:   string
}

export interface OrderWithItems extends Order {
  items: OrderItem[]
}

/** Cart line as submitted by the client (untrusted — sanitized on insert). */
export interface CartLineInput {
  athlete_id: string
  bundle:     Bundle
  config?:    unknown
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Insert a pending order + its items before redirecting to Stripe Checkout.
 * Prices are computed server-side from BUNDLES — never trusted from the client.
 */
export async function createOrder(
  stripeSessionId: string,
  lines: CartLineInput[],
): Promise<OrderWithItems> {
  if (!lines.length) throw new Error('createOrder: empty cart')
  const sql = getDb()

  const orderId    = crypto.randomUUID()
  const created_at = new Date().toISOString()
  const total      = lines.reduce((sum, l) => sum + BUNDLES[l.bundle].cents, 0)

  const orderRows = await sql`
    INSERT INTO orders
      (id, stripe_session_id, amount_cents, status, created_at)
    VALUES
      (${orderId}, ${stripeSessionId}, ${total}, 'pending', ${created_at})
    ON CONFLICT (stripe_session_id) DO NOTHING
    RETURNING *
  `
  // Duplicate call for the same session — return the existing order untouched.
  if (!orderRows.length) {
    const existing = await getOrderBySession(stripeSessionId, { includePending: true })
    if (existing) return existing
    throw new Error('createOrder: conflict but no existing order found')
  }

  const items: OrderItem[] = []
  for (const line of lines) {
    const bundle = BUNDLES[line.bundle]
    const config = sanitizeLineConfig(line.config, bundle.caps.socials)
    const rows = await sql`
      INSERT INTO order_items
        (id, order_id, athlete_id, bundle, config, amount_cents, created_at)
      VALUES
        (${crypto.randomUUID()}, ${orderId}, ${line.athlete_id}, ${line.bundle},
         ${JSON.stringify(config)}, ${bundle.cents}, ${created_at})
      RETURNING *
    `
    items.push(rowToOrderItem(rows[0]))
  }

  return { ...(orderRows[0] as Order), items }
}

/**
 * Mark an order paid + assign its FP-#### number (webhook and success-page
 * reconciliation both call this; it's idempotent).
 */
export async function confirmOrder(
  stripeSessionId:       string,
  stripePaymentIntentId: string | null,
  email:                 string | null,
): Promise<void> {
  const sql = getDb()
  await sql`
    UPDATE orders
    SET status                   = 'paid',
        order_number             = 'FP-' || nextval('fp_order_number_seq')::text,
        stripe_payment_intent_id = ${stripePaymentIntentId},
        email                    = ${email}
    WHERE stripe_session_id = ${stripeSessionId}
      AND status = 'pending'
  `
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getOrderBySession(
  stripeSessionId: string,
  opts: { includePending?: boolean } = {},
): Promise<OrderWithItems | null> {
  const sql = getDb()
  const rows = opts.includePending
    ? await sql`SELECT * FROM orders WHERE stripe_session_id = ${stripeSessionId} LIMIT 1`
    : await sql`SELECT * FROM orders WHERE stripe_session_id = ${stripeSessionId} AND status = 'paid' LIMIT 1`
  if (!rows.length) return null
  return withItems(rows[0] as Order)
}

export async function getOrderByNumber(orderNumber: string): Promise<OrderWithItems | null> {
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM orders WHERE order_number = ${orderNumber} AND status = 'paid' LIMIT 1
  `
  if (!rows.length) return null
  return withItems(rows[0] as Order)
}

async function withItems(order: Order): Promise<OrderWithItems> {
  const sql = getDb()
  const items = await sql`
    SELECT * FROM order_items WHERE order_id = ${order.id} ORDER BY created_at ASC
  `
  return { ...order, items: items.map(rowToOrderItem) }
}

function rowToOrderItem(row: Record<string, unknown>): OrderItem {
  return {
    id:           row.id           as string,
    order_id:     row.order_id     as string,
    athlete_id:   row.athlete_id   as string,
    bundle:       row.bundle       as Bundle,
    // neon returns jsonb as a parsed object; tolerate a string just in case
    config: typeof row.config === 'string'
      ? (JSON.parse(row.config) as LineConfig)
      : (row.config as LineConfig | null),
    amount_cents: row.amount_cents as number,
    created_at:   row.created_at   as string,
  }
}

// ---------------------------------------------------------------------------
// Unified access resolution — THE gate for every download route in v2
// ---------------------------------------------------------------------------

export interface Access {
  caps: Capabilities
  /** The order item that granted access (carries the styling config), if v2. */
  item: OrderItem | null
  /** Which system granted access. */
  source: 'order' | 'purchase' | null
}

export const DENIED: Access = { caps: NO_ACCESS, item: null, source: null }

/**
 * Resolve what a token unlocks for a given athlete.
 *
 * Grants if EITHER:
 *  - a paid v2 order (token = order stripe_session_id) contains an item for
 *    this athlete → capabilities of that item's bundle, OR
 *  - a paid legacy v1 purchase (token = per-athlete stripe_session_id)
 *    matches → capabilities of its tier.
 *
 * If somehow both match, capabilities are unioned.
 */
export async function resolveAccess(
  token:     string | null,
  athleteId: string,
): Promise<Access> {
  if (!token) return DENIED

  let caps  = NO_ACCESS
  let item: OrderItem | null = null
  let source: Access['source'] = null

  // v2 combined order
  const order = await getOrderBySession(token)
  if (order) {
    const match = order.items.find(i => i.athlete_id === athleteId)
    if (match) {
      caps   = BUNDLES[match.bundle].caps
      item   = match
      source = 'order'
    }
  }

  // legacy v1 per-athlete purchase
  const purchase = await getPurchaseBySession(token, athleteId)
  if (purchase) {
    caps   = mergeCapabilities(caps, tierCapabilities(purchase.tier))
    source = source ?? 'purchase'
  }

  return source ? { caps, item, source } : DENIED
}
