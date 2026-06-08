import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import {
  getOrCreateMeet,
  findOrCreateHeat,
  upsertAthlete,
  imagePathForAthlete,
  framesDirForAthlete,
} from '@/lib/database'
import {
  IS_BLOB,
  blobKeyForAthlete,
  blobFramesPrefixForAthlete,
  uploadImage,
  frameUrl,
} from '@/lib/blob-storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface AthleteInput {
  bib: string
  first_name: string
  last_name: string
  team?: string | null
  finish_time?: number | null
  place?: number | null
}

interface UploadMetadata {
  meet_name: string
  meet_date: string
  meet_location?: string | null
  company_name?: string | null
  event_num: string
  round: string
  heat: string
  event_name?: string | null
  athlete: AthleteInput
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key')
  if (apiKey !== process.env.UPLOAD_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()

    const metadataRaw = formData.get('metadata')
    if (!metadataRaw || typeof metadataRaw !== 'string') {
      return NextResponse.json({ error: 'Missing metadata field' }, { status: 400 })
    }

    let metadata: UploadMetadata
    try {
      metadata = JSON.parse(metadataRaw)
    } catch {
      return NextResponse.json({ error: 'Invalid metadata JSON' }, { status: 400 })
    }

    const { meet_name, meet_date, meet_location, company_name, event_num, round, heat, event_name, athlete } = metadata
    if (!meet_name || !meet_date || !event_num || !round || !heat || !athlete?.first_name || !athlete?.last_name) {
      return NextResponse.json({ error: 'Missing required metadata fields' }, { status: 400 })
    }

    const imageFile = formData.get('image')
    if (!imageFile || !(imageFile instanceof Blob)) {
      return NextResponse.json({ error: 'Missing image field' }, { status: 400 })
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer())

    const meetRec   = await getOrCreateMeet(meet_name, meet_date, meet_location, company_name)
    const heatRec   = await findOrCreateHeat(meetRec.id, event_num, round, heat, event_name)

    // ---------------------------------------------------------------------------
    // Save athlete image â€” blob in production, local disk in dev
    // ---------------------------------------------------------------------------
    let imagePath: string

    if (IS_BLOB()) {
      const key = blobKeyForAthlete(meetRec.id, heatRec.id, athlete.last_name, athlete.first_name, athlete.bib)
      imagePath = await uploadImage(key, imageBuffer)
    } else {
      const localPath = imagePathForAthlete(meetRec.id, heatRec.id, athlete.last_name, athlete.first_name, athlete.bib)
      fs.writeFileSync(localPath, imageBuffer)
      imagePath = localPath
    }

    // ---------------------------------------------------------------------------
    // Save IdentiLynx frames
    // ---------------------------------------------------------------------------
    let framesDir: string | null = null
    let frameCount: number | null = null
    const frameKeys = [...formData.keys()].filter((k) => /^frame_\d+$/.test(k))

    if (frameKeys.length > 0) {
      let saved = 0

      if (IS_BLOB()) {
        const prefix = blobFramesPrefixForAthlete(meetRec.id, heatRec.id, athlete.last_name, athlete.first_name, athlete.bib)
        // Upload each frame; store the base URL (derived from first uploaded frame)
        let prefixUrl: string | null = null
        for (const key of frameKeys) {
          const frameFile = formData.get(key)
          if (frameFile instanceof Blob) {
            const idx      = parseInt(key.replace('frame_', ''), 10)
            const frameKey = frameUrl(prefix, idx)
            const url      = await uploadImage(frameKey, Buffer.from(await frameFile.arrayBuffer()))
            // Derive the prefix URL by stripping the last path component
            if (prefixUrl === null) {
              prefixUrl = url.slice(0, url.lastIndexOf('/'))
            }
            saved++
          }
        }
        framesDir  = prefixUrl
        frameCount = saved
      } else {
        const localFramesDir = framesDirForAthlete(meetRec.id, heatRec.id, athlete.last_name, athlete.first_name, athlete.bib)
        for (const key of frameKeys) {
          const frameFile = formData.get(key)
          if (frameFile instanceof Blob) {
            const idx       = parseInt(key.replace('frame_', ''), 10)
            const framePath = `${localFramesDir}/frame_${String(idx).padStart(2, '0')}.jpg`
            fs.writeFileSync(framePath, Buffer.from(await frameFile.arrayBuffer()))
            saved++
          }
        }
        framesDir  = localFramesDir
        frameCount = saved
      }
    }

    const athleteRec = await upsertAthlete({
      heat_id:     heatRec.id,
      bib:         athlete.bib ?? '',
      first_name:  athlete.first_name,
      last_name:   athlete.last_name,
      team:        athlete.team ?? null,
      finish_time: athlete.finish_time ?? null,
      place:       athlete.place ?? null,
      image_path:  imagePath,
      video_path:  null,
      frames_dir:  framesDir,
      frame_count: frameCount,
    })

    return NextResponse.json({
      success:    true,
      athlete_id: athleteRec.id,
      heat_id:    heatRec.id,
    })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
