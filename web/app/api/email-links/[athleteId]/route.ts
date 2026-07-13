/**
 * POST /api/email-links/[athleteId]
 *
 * Resends purchase download links to an email address.
 * Requires a valid confirmed purchase token for the athlete.
 *
 * Body: { token: string, email: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAthleteWithContext, effectiveStatus } from '@/lib/database'
import { getPurchaseBySession } from '@/lib/purchases'
import { getOrderBySession } from '@/lib/orders'
import { BUNDLES } from '@/lib/bundles'
import { sendPurchaseEmail, sendOrderEmail } from '@/lib/email'
import { formatEventLabel } from '@/lib/format'
import type { Tier } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> },
) {
  const { athleteId } = await params

  let token: string, email: string
  try {
    const body = await request.json()
    if (!body.token || typeof body.token !== 'string') throw new Error('missing token')
    if (!body.email || typeof body.email !== 'string') throw new Error('missing email')
    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) throw new Error('invalid email')
    token = body.token
    email = body.email.trim().toLowerCase()
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid request' },
      { status: 400 },
    )
  }

  // Verify the athlete exists and heat is published
  const athlete = await getAthleteWithContext(athleteId)
  if (!athlete || effectiveStatus(athlete.heat) !== 'published') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Verify the token is a confirmed purchase for this athlete —
  // legacy per-athlete purchase, or a v2 combined order containing them
  const purchase = await getPurchaseBySession(token, athleteId)

  if (!purchase) {
    const order = await getOrderBySession(token)
    const inOrder = order?.items.some(i => i.athlete_id === athleteId)
    if (!order?.order_number || !inOrder) {
      return NextResponse.json(
        { error: 'No confirmed purchase found for this token' },
        { status: 403 },
      )
    }

    // v2 order → resend the order confirmation (links to the order page)
    try {
      const items = await Promise.all(order.items.map(async (item) => {
        const a = await getAthleteWithContext(item.athlete_id)
        return {
          athleteName: a
            ? (a.first_name ? `${a.first_name} ${a.last_name}` : a.last_name)
            : 'Athlete',
          meetName: a?.heat.meet.name ?? '',
          eventLabel: a
            ? formatEventLabel(a.heat.event_num, a.heat.round, a.heat.heat_num, a.heat.event_name)
            : '',
          bundleTitle: BUNDLES[item.bundle].title,
          priceLabel:  `$${(item.amount_cents / 100).toFixed(2)}`,
        }
      }))
      await sendOrderEmail({
        to:          email,
        orderNumber: order.order_number,
        token,
        totalLabel:  `$${(order.amount_cents / 100).toFixed(2)}`,
        items,
      })
      return NextResponse.json({ success: true })
    } catch (err) {
      console.error('Order email send failed:', err)
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }
  }

  try {
    await sendPurchaseEmail({
      to:        email,
      athleteId: athleteId,
      token,
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
  } catch (err) {
    console.error('Email send failed:', err)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
