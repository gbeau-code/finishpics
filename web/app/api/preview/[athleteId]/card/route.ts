import { NextRequest, NextResponse } from 'next/server'
import { getAthleteWithContext, effectiveStatus } from '@/lib/database'
import { readImageBuffer, imageExists } from '@/lib/blob-storage'
import { renderFinishCard } from '@/lib/social-image'
import { formatTime } from '@/lib/format'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Watermarked preview of the formatted "finish card" — the "Your finish
 * image" hero on the photo page and what the Photo/Full bundles deliver.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> },
) {
  const { athleteId } = await params
  const athlete = await getAthleteWithContext(athleteId)
  if (!athlete || effectiveStatus(athlete.heat) !== 'published') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!await imageExists(athlete.image_path)) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 })
  }

  try {
    const source = await readImageBuffer(athlete.image_path!)
    const { heat } = athlete
    const card = await renderFinishCard(source, {
      name: athlete.first_name ? `${athlete.first_name} ${athlete.last_name}` : athlete.last_name,
      team:        athlete.team,
      eventLabel:  heat.event_name ?? `Event ${heat.event_num}`,
      timeLabel:   athlete.finish_time != null ? formatTime(athlete.finish_time) : null,
      meetName:    heat.meet.name,
      venue:       heat.meet.location,
      companyName: heat.meet.company_name,
    }, { watermark: true })

    return new NextResponse(new Uint8Array(card), {
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=3600' },
    })
  } catch (err) {
    console.error('Card preview error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
