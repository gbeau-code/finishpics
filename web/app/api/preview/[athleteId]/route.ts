import { NextRequest, NextResponse } from 'next/server'
import { getAthleteWithContext, effectiveStatus } from '@/lib/database'
import { readImageBuffer, imageExists } from '@/lib/blob-storage'
import { addWatermark } from '@/lib/watermark'
import { createFormattedImage } from '@/lib/formatted-image'

export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  { params }: { params: { athleteId: string } }
) {
  const athlete = await getAthleteWithContext(params.athleteId)
  if (!athlete) {
    return NextResponse.json({ error: 'Athlete not found' }, { status: 404 })
  }

  if (effectiveStatus(athlete.heat) !== 'published') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!await imageExists(athlete.image_path)) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 })
  }

  try {
    const imageBuffer = await readImageBuffer(athlete.image_path!)
    const { heat } = athlete
    const formatted = await createFormattedImage(imageBuffer, {
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
    const watermarked = await addWatermark(formatted)

    return new NextResponse(new Uint8Array(watermarked), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (err) {
    console.error('Preview error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
