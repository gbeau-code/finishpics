import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { getAthleteWithContext, effectiveStatus } from '@/lib/database'
import { readImageBuffer, imageExists } from '@/lib/blob-storage'
import { addWatermark } from '@/lib/watermark'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Preview is displayed at most ~740px wide (main panel) and reused as the
// FinishPreview photo layer — no need to watermark/ship the full 2400px source.
const PREVIEW_MAX = 1400

/**
 * v2 preview: the CLEAN raw photo-finish frame with just the SAMPLE watermark
 * tile. (v1 rendered the formatted navy info-strip here — in v2 the styled
 * overlays are the Social Studio's job, so the strip must not appear, and it
 * must not bleed into the FinishPreview photo layer that reuses this URL.)
 */
export async function GET(
  _request: NextRequest,
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
  if (!await imageExists(athlete.image_path)) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 })
  }

  try {
    const raw = await readImageBuffer(athlete.image_path!)
    const resized = await sharp(raw)
      .resize({ width: PREVIEW_MAX, height: PREVIEW_MAX, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer()
    const watermarked = await addWatermark(resized)

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
