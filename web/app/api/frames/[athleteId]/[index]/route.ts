import { NextRequest, NextResponse } from 'next/server'
import { getAthleteWithContext, effectiveStatus } from '@/lib/database'
import { readImageBuffer, frameUrl, isBlobUrl } from '@/lib/blob-storage'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'

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
    let buffer: Buffer
    if (isBlobUrl(athlete.frames_dir)) {
      // Blob storage: construct URL from prefix
      buffer = await readImageBuffer(frameUrl(athlete.frames_dir, idx))
    } else {
      // Local filesystem
      const framePath = path.join(athlete.frames_dir, `frame_${String(idx).padStart(2, '0')}.jpg`)
      if (!fs.existsSync(framePath)) {
        return NextResponse.json({ error: 'Frame file not found' }, { status: 404 })
      }
      buffer = fs.readFileSync(framePath)
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (err) {
    console.error('Frame serve error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
