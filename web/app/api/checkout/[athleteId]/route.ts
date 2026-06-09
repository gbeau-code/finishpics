import { NextRequest, NextResponse } from 'next/server'
import { getAthleteWithContext, effectiveStatus } from '@/lib/database'
import { getStripe, TIERS, type Tier } from '@/lib/stripe'
import { createPurchase } from '@/lib/purchases'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { athleteId: string } },
) {
  const athlete = await getAthleteWithContext(params.athleteId)
  if (!athlete || effectiveStatus(athlete.heat) !== 'published') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let tier: Tier
  try {
    const body = await request.json()
    if (body.tier !== 'basic' && body.tier !== 'enhanced' && body.tier !== 'full') throw new Error('invalid tier')
    tier = body.tier as Tier
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // If full tier requested but athlete has no frames, don't mis-sell it
  const tierData = TIERS[tier]

  // Build the base URL from incoming request headers (works on any domain)
  const proto   = request.headers.get('x-forwarded-proto') ?? 'https'
  const host    = request.headers.get('host')!
  const baseUrl = `${proto}://${host}`

  const athleteName = `${athlete.first_name} ${athlete.last_name}`
  const meetName    = athlete.heat.meet.name

  try {
    const session = await getStripe().checkout.sessions.create({
      payment_method_types: ['card'],
      mode:                 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name:        `FinishPics — ${athleteName}`,
            description: `${meetName}  ·  ${tierData.description}`,
          },
          unit_amount: tierData.cents,
        },
        quantity: 1,
      }],
      metadata: {
        athleteId: params.athleteId,
        tier,
      },
      // Stripe collects email automatically; receipt is sent by Stripe
      success_url: `${baseUrl}/photo/${params.athleteId}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${baseUrl}/photo/${params.athleteId}`,
    })

    // Pre-create the purchase row (webhook will confirm it; this handles race conditions)
    await createPurchase({
      athlete_id:        params.athleteId,
      tier,
      stripe_session_id: session.id,
      amount_cents:      tierData.cents,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Checkout session creation failed:', err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
