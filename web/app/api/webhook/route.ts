import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import type { Tier } from '@/lib/stripe'
import { confirmPurchase, getPurchaseBySession } from '@/lib/purchases'
import { getAthleteWithContext } from '@/lib/database'
import { sendPurchaseEmail } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body      = await request.text()   // must read raw text for signature verification
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session   = event.data.object as Stripe.Checkout.Session
    const athleteId = session.metadata?.athleteId
    const email     = session.customer_details?.email ?? null

    // 1. Confirm the purchase in the DB
    try {
      await confirmPurchase(
        session.id,
        typeof session.payment_intent === 'string' ? session.payment_intent : null,
        email,
      )
    } catch (err) {
      console.error('Failed to confirm purchase for session', session.id, err)
      // Return 200 so Stripe doesn't retry — we'll reconcile on the success page
      return NextResponse.json({ received: true })
    }

    // 2. Send download links email (best-effort — never fail the webhook)
    if (email && athleteId) {
      try {
        const [athlete, purchase] = await Promise.all([
          getAthleteWithContext(athleteId),
          getPurchaseBySession(session.id, athleteId),
        ])

        if (athlete && purchase) {
          await sendPurchaseEmail({
            to:        email,
            athleteId,
            token:     session.id,
            tier:      purchase.tier as Tier,
            hasFrames: (athlete.frame_count ?? 0) > 0,
            athlete: {
              firstName:  athlete.first_name,
              lastName:   athlete.last_name,
              team:       athlete.team,
              finishTime: athlete.finish_time,
            },
            heat: {
              eventNum:  athlete.heat.event_num,
              eventName: athlete.heat.event_name,
              round:     athlete.heat.round,
              heatNum:   athlete.heat.heat_num,
              meetName:  athlete.heat.meet.name,
              meetDate:  athlete.heat.meet.date,
            },
          })
        }
      } catch (err) {
        // Log but don't fail — the purchase is already confirmed
        console.error('Purchase email failed for session', session.id, err)
      }
    }
  }

  return NextResponse.json({ received: true })
}
