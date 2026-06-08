import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import { getAthleteWithContext } from '@/lib/database'

export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  { params }: { params: { athleteId: string } }
) {
  const athlete = await getAthleteWithContext(params.athleteId)
  if (!athlete) {
    return NextResponse.json({ error: 'Athlete not found' }, { status: 404 })
  }

  const videoPath = athlete.video_path
  if (!videoPath || !fs.existsSync(videoPath)) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  const videoBuffer = fs.readFileSync(videoPath)
  const filename = `FinishPics-${athlete.last_name}-${athlete.bib || athlete.first_name}.avi`

  return new NextResponse(new Uint8Array(videoBuffer), {
    headers: {
      'Content-Type': 'video/x-msvideo',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': String(videoBuffer.byteLength),
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
