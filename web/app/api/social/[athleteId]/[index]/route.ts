import { NextRequest, NextResponse } from 'next/server'
import { getAthleteWithContext, effectiveStatus } from '@/lib/database'
import { readImageBuffer, imageExists, safeName } from '@/lib/blob-storage'
import { resolveAccess } from '@/lib/orders'
import { renderSocialGraphic } from '@/lib/social-image'
import { formatTime } from '@/lib/format'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/social/[athleteId]/[index]?token=<order session id>
 *
 * Renders the purchased social graphic #index (from the order item's saved
 * styling config) at full resolution from the CLEAN image. Only v2 orders
 * carry a social config — the order item's bundle must include socials.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ athleteId: string; index: string }> },
) {
  const { athleteId, index } = await params
  const idx = Number(index)

  const athlete = await getAthleteWithContext(athleteId)
  if (!athlete || effectiveStatus(athlete.heat) !== 'published') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const token  = request.nextUrl.searchParams.get('token')
  const access = await resolveAccess(token, athleteId)
  const socials = access.item?.config?.socials ?? []
  if (access.caps.socials === 0 || !access.item) {
    return NextResponse.json(
      { error: 'Purchase with social graphics required', code: 'UPGRADE_REQUIRED' },
      { status: 402 },
    )
  }
  if (!Number.isInteger(idx) || idx < 0 || idx >= socials.length) {
    return NextResponse.json({ error: 'Graphic index out of range' }, { status: 404 })
  }

  if (!await imageExists(athlete.image_path)) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 })
  }

  const config = socials[idx]
  const source = await readImageBuffer(athlete.image_path!)
  const { heat } = athlete

  const graphic = await renderSocialGraphic(
    source,
    {
      name: athlete.first_name
        ? `${athlete.first_name} ${athlete.last_name}`
        : athlete.last_name,
      team:       athlete.team,
      eventLabel: heat.event_name ?? `Event ${heat.event_num}`,
      timeLabel:  athlete.finish_time != null ? formatTime(athlete.finish_time) : null,
      meetName:   heat.meet.name,
    },
    config,
  )

  const filename = `FinishPics-${safeName(athlete.last_name)}-${config.format}.jpg`
  return new NextResponse(new Uint8Array(graphic), {
    headers: {
      'Content-Type':        'image/jpeg',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      String(graphic.byteLength),
      'Cache-Control':       'private, no-store',
    },
  })
}
