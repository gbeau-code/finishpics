import { NextRequest, NextResponse } from 'next/server'
import { getAthleteWithContext, effectiveStatus } from '@/lib/database'
import { frameUrl, readImageBuffer } from '@/lib/blob-storage'
import { requirePurchase } from '@/lib/purchases'
import sharp from 'sharp'

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

  // Raw frame download requires the full tier
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
    const raw       = await readImageBuffer(framePath)
    // Re-encode through Sharp to guarantee a clean, valid JPEG output
    const buffer    = await sharp(raw).jpeg({ quality: 95 }).toBuffer()
    const filename  = `FinishPics-${athlete.last_name}-frame${idx + 1}-raw.jpg`

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
