/**
 * GET /api/frames/[athleteId]/gif?token=<session_id>
 *
 * Generates an animated boomerang GIF from the athlete's finish-line camera images.
 * Requires a 'full' tier purchase.
 *
 * Boomerang sequence: [0,1,2,...,n-1, n-2,...,1] loops infinitely.
 * Output: 800px wide animated GIF — ready for Instagram, Twitter, iMessage, etc.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAthleteWithContext, effectiveStatus } from '@/lib/database'
import { frameUrl, readImageBuffer, safeName } from '@/lib/blob-storage'
import { resolveAccess } from '@/lib/orders'
import sharp from 'sharp'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const GIFEncoder = require('gif-encoder-2')

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GIF_MAX_WIDTH = 800   // px — good resolution for social media
const GIF_DELAY_MS  = 120   // ms per frame (~8 fps)
const GIF_QUALITY   = 1     // neuquant quality: 1 = best colour, 30 = fastest

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> },
) {
  const { athleteId } = await params
  const athlete = await getAthleteWithContext(athleteId)
  if (!athlete || effectiveStatus(athlete.heat) !== 'published') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!athlete.frames_dir || !athlete.frame_count || athlete.frame_count < 1) {
    return NextResponse.json({ error: 'No frames available' }, { status: 404 })
  }

  // Boomerang GIF: legacy full tier, or v2 Full bundle
  const token  = request.nextUrl.searchParams.get('token')
  const access = await resolveAccess(token, athleteId)
  if (!access.caps.frames) {
    return NextResponse.json({ error: 'Full package purchase required', code: 'UPGRADE_REQUIRED' }, { status: 402 })
  }

  try {
    // Load all raw frame buffers
    const rawFrames: Buffer[] = []
    for (let i = 0; i < athlete.frame_count; i++) {
      rawFrames.push(await readImageBuffer(frameUrl(athlete.frames_dir, i)))
    }

    // Determine output dimensions from first frame
    const firstMeta = await sharp(rawFrames[0]).metadata()
    const origW = firstMeta.width  ?? GIF_MAX_WIDTH
    const origH = firstMeta.height ?? 360
    const gifW  = Math.min(GIF_MAX_WIDTH, origW)
    const gifH  = Math.round(origH * gifW / origW)

    // Boomerang sequence: [0,1,...,n-1, n-2,...,1]
    const forward  = rawFrames.map((_, i) => i)
    const reverse  = rawFrames.length > 2
      ? rawFrames.slice(1, -1).map((_, i) => rawFrames.length - 2 - i)
      : []
    const sequence = [...forward, ...reverse]

    // Resize each frame to RGBA pixel data
    const frameData: Buffer[] = []
    for (const idx of sequence) {
      const { data } = await sharp(rawFrames[idx])
        .resize(gifW, gifH, { fit: 'fill' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
      frameData.push(data)
    }

    // Encode animated GIF
    const encoder = new GIFEncoder(gifW, gifH, 'neuquant', false, frameData.length)
    encoder.setDelay(GIF_DELAY_MS)
    encoder.setQuality(GIF_QUALITY)
    encoder.setRepeat(0)   // infinite loop
    encoder.start()
    for (const frame of frameData) {
      encoder.addFrame(frame)
    }
    encoder.finish()

    const gifBuffer = Buffer.from(encoder.out.getData())
    const filename  = `FinishPics-${safeName(athlete.last_name)}-boomerang.gif`

    return new NextResponse(new Uint8Array(gifBuffer), {
      headers: {
        'Content-Type':        'image/gif',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control':       'private, no-store',
      },
    })
  } catch (err) {
    console.error('Boomerang generation error:', err)
    return NextResponse.json({ error: 'Boomerang generation failed' }, { status: 500 })
  }
}
