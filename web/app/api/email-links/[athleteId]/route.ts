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
import { sendPurchaseEmail } from '@/lib/email'
import type { Tier } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { athleteId: string } },
) {
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
  const athlete = await getAthleteWithContext(params.athleteId)
  if (!athlete || effectiveStatus(athlete.heat) !== 'published') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Verify the token is a confirmed purchase for this athlete
  const purchase = await getPurchaseBySession(token, params.athleteId)
  if (!purchase) {
    return NextResponse.json(
      { error: 'No confirmed purchase found for this token' },
      { status: 403 },
    )
  }

  try {
    await sendPurchaseEmail({
      to:        email,
      athleteId: params.athleteId,
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
