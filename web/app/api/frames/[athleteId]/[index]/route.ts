import { NextRequest, NextResponse } from 'next/server'
import { getAthleteWithContext, effectiveStatus } from '@/lib/database'
import { frameUrl, readImageBuffer } from '@/lib/blob-storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
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

  try {
    const framePath = frameUrl(athlete.frames_dir, idx)
    const buffer = await readImageBuffer(framePath)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Frame not found' }, { status: 404 })
  }
}
