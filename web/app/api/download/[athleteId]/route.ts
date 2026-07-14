import { NextRequest, NextResponse } from 'next/server'
import { getAthleteWithContext, effectiveStatus } from '@/lib/database'
import { readImageBuffer, imageExists, safeName } from '@/lib/blob-storage'
import { renderFinishCard } from '@/lib/social-image'
import { formatTime } from '@/lib/format'
import { resolveAccess } from '@/lib/orders'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> }
) {
  const { athleteId } = await params
  const athlete = await getAthleteWithContext(athleteId)
  if (!athlete) {
    return NextResponse.json({ error: 'Athlete not found' }, { status: 404 })
  }

  if (effectiveStatus(athlete.heat) !== 'published') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Formatted image: legacy enhanced+ tiers, or v2 Photo/Full bundles
  const token  = request.nextUrl.searchParams.get('token')
  const access = await resolveAccess(token, athleteId)
  if (!access.caps.formatted) {
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
  // v2 formatted deliverable = the finish card (matches the on-page hero &
  // Studio preview). Replaces the v1 navy info-strip.
  const formatted = await renderFinishCard(rawBuffer, {
    name: athlete.first_name ? `${athlete.first_name} ${athlete.last_name}` : athlete.last_name,
    team:        athlete.team,
    eventLabel:  heat.event_name ?? `Event ${heat.event_num}`,
    timeLabel:   athlete.finish_time != null ? formatTime(athlete.finish_time) : null,
    meetName:    heat.meet.name,
    venue:       heat.meet.location,
    companyName: heat.meet.company_name,
  })

  const filename = `FinishPics-${safeName(athlete.last_name)}-${safeName(athlete.bib ?? 'nobib')}-formatted.jpg`
  return new NextResponse(new Uint8Array(formatted), {
    headers: {
      'Content-Type':        'image/jpeg',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      String(formatted.byteLength),
      'Cache-Control':       'private, no-store',
    },
  })
}
