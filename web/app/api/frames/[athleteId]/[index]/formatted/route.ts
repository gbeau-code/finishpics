import { NextRequest, NextResponse } from 'next/server'
import { getAthleteWithContext, effectiveStatus } from '@/lib/database'
import { frameUrl, readImageBuffer, safeName } from '@/lib/blob-storage'
import { createFormattedImage } from '@/lib/formatted-image'
import { requirePurchase } from '@/lib/purchases'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { athleteId: string; index: string } }
) {
  const athlete = await getAthleteWithContext(params.athleteId)
  if (!athlete) {
    return NextResponse.json({ error: 'Athlete not found' }, { status: 404 })
  }

  if (effectiveStatus(athlete.heat) !== 'published') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!athlete.frames_dir || athlete.frame_count == null) {
    return NextResponse.json({ error: 'No frames available' }, { status: 404 })
  }

  const idx = parseInt(params.index, 10)
  if (isNaN(idx) || idx < 0 || idx >= athlete.frame_count) {
    return NextResponse.json({ error: 'Frame index out of range' }, { status: 404 })
  }

  // Formatted frame download requires the full tier
  const token    = request.nextUrl.searchParams.get('token')
  const purchase = await requirePurchase(token, params.athleteId, 'full')
  if (!purchase) {
    return NextResponse.json(
      { error: 'Purchase required', code: 'UPGRADE_REQUIRED' },
      { status: 402 },
    )
  }

  try {
    const framePath = frameUrl(athlete.frames_dir, idx)
    const rawBuffer = await readImageBuffer(framePath)
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

    const filename = `FinishPics-${safeName(athlete.last_name)}-frame${idx + 1}-formatted.jpg`
    return new NextResponse(new Uint8Array(formatted), {
      headers: {
        'Content-Type':        'image/jpeg',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control':       'private, no-store',
      },
    })
  } catch (err) {
    console.error('Formatted frame error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
