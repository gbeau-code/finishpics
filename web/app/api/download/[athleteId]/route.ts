import { NextRequest, NextResponse } from 'next/server'
import { getAthleteWithContext, effectiveStatus } from '@/lib/database'
import { readImageBuffer, imageExists } from '@/lib/blob-storage'
import { createFormattedImage } from '@/lib/formatted-image'
import { requirePurchase } from '@/lib/purchases'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { athleteId: string } }
) {
  const athlete = await getAthleteWithContext(params.athleteId)
  if (!athlete) {
    return NextResponse.json({ error: 'Athlete not found' }, { status: 404 })
  }

  if (effectiveStatus(athlete.heat) !== 'published') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Formatted image requires the full tier
  const token    = request.nextUrl.searchParams.get('token')
  const purchase = await requirePurchase(token, params.athleteId, 'full')
  if (!purchase) {
    return NextResponse.json(
      { error: 'Purchase required', code: 'UPGRADE_REQUIRED' },
      { status: 402 },
    )
  }

  if (!await imageExists(athlete.image_path)) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 })
  }

  const rawBuffer = await readImageBuffer(athlete.image_path!)
  const { heat }  = athlete
  const formatted = await createFormattedImage(rawBuffer, {
    firstName:    athlete.first_name,
    lastName:     athlete.last_name,
    bib:          athlete.bib,
    team:         athlete.team,
    place:        athlete.place,
    finishTime:   athlete.finish_time,
    eventName:    heat.event_name,
    eventNum:     heat.event_num,
    round:        heat.round,
    heatNum:      heat.heat_num,
    meetName:     heat.meet.name,
    meetDate:     heat.meet.date,
    meetLocation: heat.meet.location,
    companyName:  heat.meet.company_name,
  })

  const filename = `FinishPics-${athlete.last_name}-${athlete.bib}-formatted.jpg`
  return new NextResponse(new Uint8Array(formatted), {
    headers: {
      'Content-Type':        'image/jpeg',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      String(formatted.byteLength),
      'Cache-Control':       'private, no-store',
    },
  })
}
