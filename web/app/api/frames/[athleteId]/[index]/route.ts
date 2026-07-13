import { NextRequest, NextResponse } from 'next/server'
import { getAthleteWithContext, effectiveStatus } from '@/lib/database'
import { frameUrl, readImageBuffer, safeName } from '@/lib/blob-storage'
import { resolveAccess } from '@/lib/orders'
import sharp from 'sharp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ athleteId: string; index: string }> }
) {
  const { athleteId, index } = await params
  const athlete = await getAthleteWithContext(athleteId)
  if (!athlete) {
    return NextResponse.json({ error: 'Athlete not found' }, { status: 404 })
  }

  if (effectiveStatus(athlete.heat) !== 'published') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!athlete.frames_dir || athlete.frame_count == null) {
    return NextResponse.json({ error: 'No frames available' }, { status: 404 })
  }

  const idx = parseInt(index, 10)
  if (isNaN(idx) || idx < 0 || idx >= athlete.frame_count) {
    return NextResponse.json({ error: 'Frame index out of range' }, { status: 404 })
  }

  // Raw frame download: legacy full tier, or v2 Full bundle
  const token  = request.nextUrl.searchParams.get('token')
  const access = await resolveAccess(token, athleteId)
  if (!access.caps.frames) {
    return NextResponse.json(
      { error: 'Purchase required', code: 'UPGRADE_REQUIRED' },
      { status: 402 },
    )
  }

  try {
    const framePath = frameUrl(athlete.frames_dir, idx)
    const raw       = await readImageBuffer(framePath)
    // Re-encode through Sharp to guarantee a clean, valid JPEG output
    const buffer    = await sharp(raw).jpeg({ quality: 95 }).toBuffer()
    const filename  = `FinishPics-${safeName(athlete.last_name)}-frame${idx + 1}-raw.jpg`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':        'image/jpeg',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control':       'private, no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Frame not found' }, { status: 404 })
  }
}
