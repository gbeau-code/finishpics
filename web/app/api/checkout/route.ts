import { NextRequest, NextResponse } from 'next/server'
import { getAthleteWithContext, effectiveStatus } from '@/lib/database'
import { getStripe } from '@/lib/stripe'
import { BUNDLES, isBundle } from '@/lib/bundles'
import { createOrder } from '@/lib/orders'
import type { CartLineInput } from '@/lib/orders'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_LINES = 20

/**
 * v2 combined checkout — one Stripe session for the whole cart.
 * Body: { lines: [{ athleteId, bundle, config }] }
 * Prices come from BUNDLES server-side; the client's config is sanitized in
 * createOrder. Legacy per-athlete checkout lives at /api/checkout/[athleteId].
 */
export async function POST(request: NextRequest) {
  let rawLines: Array<{ athleteId?: unknown; bundle?: unknown; config?: unknown }>
  try {
    const body = await request.json()
    if (!Array.isArray(body.lines) || body.lines.length === 0) throw new Error('empty')
    if (body.lines.length > MAX_LINES) throw new Error('too many lines')
    rawLines = body.lines
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Validate every line: real published athlete + known bundle
  const lines: CartLineInput[] = []
  const lineItems: Array<{ name: string; description: string; cents: number }> = []
  for (const raw of rawLines) {
    if (typeof raw.athleteId !== 'string' || !isBundle(raw.bundle)) {
      return NextResponse.json({ error: 'Invalid cart line' }, { status: 400 })
    }
    const athlete = await getAthleteWithContext(raw.athleteId)
    if (!athlete || effectiveStatus(athlete.heat) !== 'published') {
      return NextResponse.json(
        { error: 'One of the photos in your cart is no longer available', athleteId: raw.athleteId },
        { status: 409 },
      )
    }
    const bundle = BUNDLES[raw.bundle]
    const athleteName = athlete.first_name
      ? `${athlete.first_name} ${athlete.last_name}`
      : athlete.last_name
    lines.push({ athlete_id: raw.athleteId, bundle: raw.bundle, config: raw.config })
    lineItems.push({
      name:        `FinishPics — ${athleteName} (${bundle.title})`,
      description: `${athlete.heat.meet.name}  ·  ${bundle.description}`,
      cents:       bundle.cents,
    })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? `${request.headers.get('x-forwarded-proto') ?? 'https'}://${request.headers.get('host')!}`

  try {
    const session = await getStripe().checkout.sessions.create({
      payment_method_types: ['card'],
      mode:                 'payment',
      line_items: lineItems.map(li => ({
        price_data: {
          currency:     'usd',
          product_data: { name: li.name, description: li.description },
          unit_amount:  li.cents,
        },
        quantity: 1,
      })),
      // Marks this session as a v2 combined order for the webhook
      metadata: { fpKind: 'order' },
      success_url: `${baseUrl}/order/confirm?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${baseUrl}/cart`,
    })

    // Pre-create the pending order + items (webhook confirms; success page reconciles)
    await createOrder(session.id, lines)

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Combined checkout session creation failed:', err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
