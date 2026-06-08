import { NextRequest, NextResponse } from 'next/server'
import { getAthleteWithContext, effectiveStatus } from '@/lib/database'
import { readImageBuffer, imageExists } from '@/lib/blob-storage'

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

  if (!athlete.image_path || !(await imageExists(athlete.image_path))) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 })
  }

  const imageBuffer = await readImageBuffer(athlete.image_path)
  const filename = `FinishPics-${athlete.last_name}-${athlete.bib}-raw.jpg`

  return new NextResponse(new Uint8Array(imageBuffer), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(imageBuffer.byteLength),
    },
  })
}
