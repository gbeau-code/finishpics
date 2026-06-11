/**
 * POST /api/upload/frames
 *
 * Accepts IdentiLynx frames for an already-uploaded athlete.
 * Called as a separate request after the main /api/upload so the combined
 * payload never approaches Vercel's 4.5 MB serverless body limit.
 *
 * Body: multipart/form-data
 *   athlete_id  — text, UUID returned by /api/upload
 *   frame_0     — JPEG blob
 *   frame_1     — JPEG blob
 *   ...
 */

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import { neon } from '@neondatabase/serverless'
import { getAthleteWithContext } from '@/lib/database'
import {
  IS_BLOB,
  blobFramesPrefixForAthlete,
  uploadImage,
  frameUrl,
} from '@/lib/blob-storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isValidUploadKey(key: string | null): boolean {
  if (!key) return false
  const keys = (process.env.UPLOAD_API_KEYS ?? process.env.UPLOAD_API_KEY ?? '')
    .split(',').map(k => k.trim()).filter(Boolean)
  return keys.includes(key)
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key')
  if (!isValidUploadKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData  = await request.formData()
    const athleteId = formData.get('athlete_id')
    if (!athleteId || typeof athleteId !== 'string') {
      return NextResponse.json({ error: 'Missing athlete_id' }, { status: 400 })
    }

    // Fetch athlete + heat + meet in one query (need meet_id for blob key)
    const athlete = await getAthleteWithContext(athleteId)
    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 })
    }

    // total_frames is sent by the agent so we always write the correct count
    // to the DB even when frames arrive in multiple batches.
    // Clamped to MAX_FRAMES to prevent DB abuse via inflated values.
    const MAX_FRAMES        = 100
    const totalFramesRaw    = formData.get('total_frames')
    const totalFramesParsed = totalFramesRaw ? parseInt(totalFramesRaw as string, 10) : null
    const totalFrames       = totalFramesParsed && totalFramesParsed > 0
      ? Math.min(totalFramesParsed, MAX_FRAMES)
      : null

    const frameKeys = [...formData.keys()]
      .filter(k => /^frame_\d+$/.test(k))
      .sort((a, b) => parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]))

    if (frameKeys.length === 0) {
      return NextResponse.json({ error: 'No frames provided' }, { status: 400 })
    }

    const meetId   = athlete.heat.meet.id
    const heatId   = athlete.heat_id
    const lastName  = athlete.last_name
    const firstName = athlete.first_name
    const bib       = athlete.bib

    let framesDir:  string | null = null
    let frameCount  = 0

    if (IS_BLOB()) {
      const prefix     = blobFramesPrefixForAthlete(meetId, heatId, lastName, firstName, bib)
      let   prefixUrl: string | null = null

      for (const key of frameKeys) {
        const frameFile = formData.get(key)
        if (frameFile instanceof Blob) {
          const idx      = parseInt(key.replace('frame_', ''), 10)
          const frameKey = frameUrl(prefix, idx)
          const url      = await uploadImage(frameKey, Buffer.from(await frameFile.arrayBuffer()))
          if (prefixUrl === null) {
            prefixUrl = url.slice(0, url.lastIndexOf('/'))
          }
          frameCount++
        }
      }
      framesDir = prefixUrl
    } else {
      // Local dev — import the helper that creates the directory
      const { framesDirForAthlete } = await import('@/lib/database')
      const localFramesDir = framesDirForAthlete(meetId, heatId, lastName, firstName, bib)
      fs.mkdirSync(localFramesDir, { recursive: true })

      for (const key of frameKeys) {
        const frameFile = formData.get(key)
        if (frameFile instanceof Blob) {
          const idx       = parseInt(key.replace('frame_', ''), 10)
          const framePath = `${localFramesDir}/frame_${String(idx).padStart(2, '0')}.jpg`
          fs.writeFileSync(framePath, Buffer.from(await frameFile.arrayBuffer()))
          frameCount++
        }
      }
      framesDir = localFramesDir
    }

    // Persist frame info — use totalFrames if provided (multi-batch upload),
    // otherwise fall back to the count of frames received in this request.
    const finalCount = (totalFrames && totalFrames > 0) ? totalFrames : frameCount
    const sql = neon(process.env.DATABASE_URL!)
    await sql`
      UPDATE athletes
      SET frames_dir  = ${framesDir},
          frame_count = ${finalCount}
      WHERE id = ${athleteId}
    `

    return NextResponse.json({ success: true, frame_count: finalCount })
  } catch (err) {
    console.error('Frame upload error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
