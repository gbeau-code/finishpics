/**
 * GET /api/frames/[athleteId]/gif?token=<session_id>
 *
 * Generates an animated boomerang WebP from the athlete's IdentiLynx frames.
 * Requires a 'full' tier purchase.
 *
 * Boomerang sequence: [0,1,2,...,n-1, n-2,...,1] loops infinitely.
 * Frames are resized to ≤800px wide and encoded as animated WebP (full color,
 * no palette limit — significantly better quality than GIF).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAthleteWithContext, effectiveStatus } from '@/lib/database'
import { frameUrl, readImageBuffer, safeName } from '@/lib/blob-storage'
import { getPurchaseBySession } from '@/lib/purchases'
import sharp from 'sharp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BOOMERANG_MAX_WIDTH = 800   // px — enough for any screen, keeps file size sane
const BOOMERANG_DELAY_MS  = 120   // ms per frame (~8 fps)
const BOOMERANG_QUALITY   = 82    // WebP quality (0–100); 82 is a good balance

export async function GET(
  request: NextRequest,
  { params }: { params: { athleteId: string } },
) {
  const athlete = await getAthleteWithContext(params.athleteId)
  if (!athlete || effectiveStatus(athlete.heat) !== 'published') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!athlete.frames_dir || !athlete.frame_count || athlete.frame_count < 1) {
    return NextResponse.json({ error: 'No frames available' }, { status: 404 })
  }

  // Require a valid full-tier purchase
  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'Purchase required', code: 'NO_PURCHASE' }, { status: 402 })
  }
  const purchase = await getPurchaseBySession(token, params.athleteId)
  if (!purchase || purchase.tier !== 'full') {
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
    const origW = firstMeta.width  ?? BOOMERANG_MAX_WIDTH
    const origH = firstMeta.height ?? 360
    const outW  = Math.min(BOOMERANG_MAX_WIDTH, origW)
    const outH  = Math.round(origH * outW / origW)

    // Boomerang sequence: [0,1,...,n-1, n-2,...,1]
    const forward  = rawFrames.map((_, i) => i)
    const reverse  = rawFrames.length > 2
      ? rawFrames.slice(1, -1).map((_, i) => rawFrames.length - 2 - i)
      : []
    const sequence = [...forward, ...reverse]

    // Resize each frame to raw RGB pixels
    const framePixels: Buffer[] = []
    for (const idx of sequence) {
      const { data } = await sharp(rawFrames[idx])
        .resize(outW, outH, { fit: 'fill' })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
      framePixels.push(data)
    }

    // Stack all frames into one tall buffer — Sharp splits on pageHeight for animation
    const stacked = Buffer.concat(framePixels)

    // Encode as animated WebP — full color depth, no palette limit
    const webpBuffer = await sharp(stacked, {
      raw: {
        width:    outW,
        height:   outH * sequence.length,
        channels: 3,
      },
    })
    .webp({
      quality:    BOOMERANG_QUALITY,
      loop:       0,     // infinite loop
      delay:      Array(sequence.length).fill(BOOMERANG_DELAY_MS),
      pageHeight: outH,  // tells Sharp each frame is outH pixels tall
    })
    .toBuffer()

    const filename = `FinishPics-${safeName(athlete.last_name)}-boomerang.webp`

    return new NextResponse(new Uint8Array(webpBuffer), {
      headers: {
        'Content-Type':        'image/webp',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control':       'private, no-store',
      },
    })
  } catch (err) {
    console.error('Boomerang generation error:', err)
    return NextResponse.json({ error: 'Boomerang generation failed' }, { status: 500 })
  }
}
