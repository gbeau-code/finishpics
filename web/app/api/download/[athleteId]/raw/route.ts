import { NextRequest, NextResponse } from 'next/server'
import { getAthleteWithContext, effectiveStatus } from '@/lib/database'
import { readImageBuffer, imageExists, safeName } from '@/lib/blob-storage'
import { requirePurchase } from '@/lib/purchases'

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

  // Raw photo-finish download requires at minimum a basic purchase
  const token    = request.nextUrl.searchParams.get('token')
  const purchase = await requirePurchase(token, athleteId, 'basic')
  if (!purchase) {
    return NextResponse.json(
      { error: 'Purchase required', code: 'NO_PURCHASE' },
      { status: 402 },
    )
  }

  if (!await imageExists(athlete.image_path)) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 })
  }

  const imageBuffer = await readImageBuffer(athlete.image_path!)
  const filename    = `FinishPics-${safeName(athlete.last_name)}-${safeName(athlete.bib ?? 'nobib')}-raw.jpg`

  return new NextResponse(new Uint8Array(imageBuffer), {
    headers: {
      'Content-Type':        'image/jpeg',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      String(imageBuffer.byteLength),
      'Cache-Control':       'private, no-store',
    },
  })
}
