/**
 * database.ts — FinishPics data layer (Neon Postgres)
 *
 * Uses Neon serverless Postgres in production (DATABASE_URL set by Vercel).
 * For local dev, add DATABASE_URL to web/.env.local from the Vercel dashboard.
 */

import { neon } from '@neondatabase/serverless'
import crypto from 'crypto'
import path from 'path'
import fs from 'fs'

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

function getDb() {
  return neon(process.env.DATABASE_URL!)
}

// ---------------------------------------------------------------------------
// Local filesystem constants (used only when BLOB_READ_WRITE_TOKEN is absent)
// ---------------------------------------------------------------------------

export const DATA_DIR   = path.resolve(process.cwd(), '..', 'data')
export const IMAGES_DIR = path.join(DATA_DIR, 'images')
export const DB_PATH    = path.join(DATA_DIR, 'db.json')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Meet {
  id: string
  name: string
  date: string
  location: string | null
  company_name: string | null
  created_at: string
}

export interface Heat {
  id: string
  meet_id: string
  event_num: string
  round: string
  heat_num: string
  event_name: string | null
  image_path: string | null
  image_width: number | null
  image_height: number | null
  first_frame_time: number | null
  last_frame_time: number | null
  status?: 'draft' | 'published' | 'hidden'
  created_at: string
}

export interface Athlete {
  id: string
  heat_id: string
  bib: string
  first_name: string
  last_name: string
  team: string | null
  finish_time: number | null
  place: number | null
  image_path: string | null
  video_path: string | null
  frames_dir: string | null
  frame_count: number | null
  created_at: string
}

export interface AthleteWithContext extends Athlete {
  heat: Heat & { meet: Meet }
}

export interface HeatWithAthletes extends Heat {
  athletes: Athlete[]
}

export interface MeetWithHeats extends Meet {
  heats: HeatWithAthletes[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uuid(): string { return crypto.randomUUID() }
function now(): string  { return new Date().toISOString() }

/** Returns the effective status for a heat, defaulting existing heats to 'published'. */
export function effectiveStatus(heat: Heat): 'draft' | 'published' | 'hidden' {
  return (heat.status as 'draft' | 'published' | 'hidden') ?? 'published'
}

/** Sanitise a name component for use in a filename (local dev only). */
function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'unknown'
}

// ---------------------------------------------------------------------------
// Meets
// ---------------------------------------------------------------------------

export async function getOrCreateMeet(
  name: string,
  date: string,
  location?: string | null,
  companyName?: string | null,
): Promise<Meet> {
  const sql = getDb()
  // Single atomic upsert — safe against concurrent uploads hitting the same meet.
  // ON CONFLICT requires the unique index meets_name_date_idx (created by init-db).
  const rows = await sql`
    INSERT INTO meets (id, name, date, location, company_name, created_at)
    VALUES (${uuid()}, ${name}, ${date}, ${location ?? null}, ${companyName ?? null}, ${now()})
    ON CONFLICT (name, date) DO UPDATE SET
      location     = COALESCE(NULLIF(EXCLUDED.location,     ''), meets.location),
      company_name = COALESCE(NULLIF(EXCLUDED.company_name, ''), meets.company_name)
    RETURNING *
  `
  return rows[0] as Meet
}

export async function getMeet(id: string): Promise<Meet | null> {
  const sql = getDb()
  const rows = await sql`SELECT * FROM meets WHERE id = ${id} LIMIT 1`
  return rows.length ? (rows[0] as Meet) : null
}

export async function getRecentMeets(limit = 10): Promise<Meet[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM meets ORDER BY created_at DESC LIMIT ${limit}
  `
  return rows as Meet[]
}

// ---------------------------------------------------------------------------
// Heats
// ---------------------------------------------------------------------------

export async function getHeat(id: string): Promise<Heat | null> {
  const sql = getDb()
  const rows = await sql`SELECT * FROM heats WHERE id = ${id} LIMIT 1`
  return rows.length ? (rows[0] as Heat) : null
}

export async function findOrCreateHeat(
  meetId: string,
  eventNum: string,
  round: string,
  heatNum: string,
  eventName?: string | null,
): Promise<Heat> {
  const sql = getDb()
  // Insert and return — if the heat already exists (concurrent upload), do nothing
  // and fall back to a SELECT. Requires unique index heats_meet_event_round_heat_idx.
  const inserted = await sql`
    INSERT INTO heats
      (id, meet_id, event_num, round, heat_num, event_name,
       image_path, image_width, image_height, first_frame_time, last_frame_time,
       status, created_at)
    VALUES
      (${uuid()}, ${meetId}, ${eventNum}, ${round}, ${heatNum}, ${eventName ?? null},
       null, null, null, null, null,
       'draft', ${now()})
    ON CONFLICT (meet_id, event_num, round, heat_num) DO NOTHING
    RETURNING *
  `
  if (inserted.length > 0) return inserted[0] as Heat

  const existing = await sql`
    SELECT * FROM heats
    WHERE meet_id  = ${meetId}
      AND event_num = ${eventNum}
      AND round     = ${round}
      AND heat_num  = ${heatNum}
    LIMIT 1
  `
  return existing[0] as Heat
}

export async function updateHeatStatus(
  heatId: string,
  status: 'draft' | 'published' | 'hidden',
): Promise<Heat | null> {
  const sql = getDb()
  const rows = await sql`
    UPDATE heats SET status = ${status} WHERE id = ${heatId} RETURNING *
  `
  return rows.length ? (rows[0] as Heat) : null
}

// ---------------------------------------------------------------------------
// Athletes
// ---------------------------------------------------------------------------

export async function getAthlete(id: string): Promise<Athlete | null> {
  const sql = getDb()
  const rows = await sql`SELECT * FROM athletes WHERE id = ${id} LIMIT 1`
  return rows.length ? (rows[0] as Athlete) : null
}

export async function upsertAthlete(data: Omit<Athlete, 'id' | 'created_at'>): Promise<Athlete> {
  const sql = getDb()
  const noBib = !data.bib || data.bib === '0'

  const existing = noBib
    ? await sql`
        SELECT * FROM athletes
        WHERE heat_id = ${data.heat_id}
          AND LOWER(first_name) = LOWER(${data.first_name})
          AND LOWER(last_name)  = LOWER(${data.last_name})
        LIMIT 1
      `
    : await sql`
        SELECT * FROM athletes
        WHERE heat_id = ${data.heat_id} AND bib = ${data.bib}
        LIMIT 1
      `

  if (existing.length > 0) {
    const rows = await sql`
      UPDATE athletes SET
        first_name  = ${data.first_name},
        last_name   = ${data.last_name},
        team        = ${data.team ?? null},
        finish_time = ${data.finish_time ?? null},
        place       = ${data.place ?? null},
        image_path  = ${data.image_path ?? null},
        video_path  = ${data.video_path ?? null},
        frames_dir  = ${data.frames_dir ?? null},
        frame_count = ${data.frame_count ?? null}
      WHERE id = ${(existing[0] as Athlete).id}
      RETURNING *
    `
    return rows[0] as Athlete
  }

  const rows = await sql`
    INSERT INTO athletes
      (id, heat_id, bib, first_name, last_name, team, finish_time, place,
       image_path, video_path, frames_dir, frame_count, created_at)
    VALUES
      (${uuid()}, ${data.heat_id}, ${data.bib}, ${data.first_name}, ${data.last_name},
       ${data.team ?? null}, ${data.finish_time ?? null}, ${data.place ?? null},
       ${data.image_path ?? null}, ${data.video_path ?? null},
       ${data.frames_dir ?? null}, ${data.frame_count ?? null}, ${now()})
    RETURNING *
  `
  return rows[0] as Athlete
}

export async function getAthleteWithContext(id: string): Promise<AthleteWithContext | null> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      a.*,
      h.id            AS heat_id_,
      h.meet_id       AS heat_meet_id,
      h.event_num     AS heat_event_num,
      h.round         AS heat_round,
      h.heat_num      AS heat_heat_num,
      h.event_name    AS heat_event_name,
      h.image_path    AS heat_image_path,
      h.image_width   AS heat_image_width,
      h.image_height  AS heat_image_height,
      h.first_frame_time AS heat_first_frame_time,
      h.last_frame_time  AS heat_last_frame_time,
      h.status        AS heat_status,
      h.created_at    AS heat_created_at,
      m.id            AS meet_id_,
      m.name          AS meet_name,
      m.date          AS meet_date,
      m.location      AS meet_location,
      m.company_name  AS meet_company_name,
      m.created_at    AS meet_created_at
    FROM athletes a
    JOIN heats h ON h.id = a.heat_id
    JOIN meets  m ON m.id = h.meet_id
    WHERE a.id = ${id}
    LIMIT 1
  `
  if (!rows.length) return null
  return rowToAthleteWithContext(rows[0])
}

export async function searchAthletes(
  query: string,
  meetId?: string | null,
  limit = 20,
  filters?: { event?: string | null; round?: string | null; heat?: string | null },
): Promise<AthleteWithContext[]> {
  const sql = getDb()
  const q   = query.toLowerCase().trim()
  // Event filters apply in SQL (before LIMIT) so filtered matches never
  // vanish behind the row cap. Only used with a meetId (the chips UI).
  const fEvent = filters?.event ?? null
  const fRound = filters?.round ?? null
  const fHeat  = filters?.heat  ?? null

  const rows = meetId
    ? await sql`
        SELECT
          a.*,
          h.id            AS heat_id_,
          h.meet_id       AS heat_meet_id,
          h.event_num     AS heat_event_num,
          h.round         AS heat_round,
          h.heat_num      AS heat_heat_num,
          h.event_name    AS heat_event_name,
          h.image_path    AS heat_image_path,
          h.image_width   AS heat_image_width,
          h.image_height  AS heat_image_height,
          h.first_frame_time AS heat_first_frame_time,
          h.last_frame_time  AS heat_last_frame_time,
          h.status        AS heat_status,
          h.created_at    AS heat_created_at,
          m.id            AS meet_id_,
          m.name          AS meet_name,
          m.date          AS meet_date,
          m.location      AS meet_location,
          m.company_name  AS meet_company_name,
          m.created_at    AS meet_created_at
        FROM athletes a
        JOIN heats h ON h.id = a.heat_id
        JOIN meets  m ON m.id = h.meet_id
        WHERE
          h.status = 'published'
          AND m.id = ${meetId}
          AND (${fEvent}::text IS NULL OR h.event_num = ${fEvent})
          AND (${fRound}::text IS NULL OR h.round     = ${fRound})
          AND (${fHeat}::text  IS NULL OR h.heat_num  = ${fHeat})
          AND (
            LOWER(a.first_name) LIKE ${'%' + q + '%'}
            OR LOWER(a.last_name)  LIKE ${'%' + q + '%'}
            OR LOWER(a.bib)        = ${q}
          )
        ORDER BY a.created_at DESC
        LIMIT ${limit}
      `
    : await sql`
        SELECT
          a.*,
          h.id            AS heat_id_,
          h.meet_id       AS heat_meet_id,
          h.event_num     AS heat_event_num,
          h.round         AS heat_round,
          h.heat_num      AS heat_heat_num,
          h.event_name    AS heat_event_name,
          h.image_path    AS heat_image_path,
          h.image_width   AS heat_image_width,
          h.image_height  AS heat_image_height,
          h.first_frame_time AS heat_first_frame_time,
          h.last_frame_time  AS heat_last_frame_time,
          h.status        AS heat_status,
          h.created_at    AS heat_created_at,
          m.id            AS meet_id_,
          m.name          AS meet_name,
          m.date          AS meet_date,
          m.location      AS meet_location,
          m.company_name  AS meet_company_name,
          m.created_at    AS meet_created_at
        FROM athletes a
        JOIN heats h ON h.id = a.heat_id
        JOIN meets  m ON m.id = h.meet_id
        WHERE
          h.status = 'published'
          AND (
            LOWER(a.first_name) LIKE ${'%' + q + '%'}
            OR LOWER(a.last_name)  LIKE ${'%' + q + '%'}
            OR LOWER(a.bib)        = ${q}
          )
        ORDER BY a.created_at DESC
        LIMIT ${limit}
      `

  return rows.map(rowToAthleteWithContext)
}

/** Distinct published events/heats in a meet — powers the search filter chips. */
export interface MeetEvent {
  event_num:  string
  round:      string
  heat_num:   string
  event_name: string | null
  athlete_count: number
}

export async function getPublishedEventsForMeet(meetId: string): Promise<MeetEvent[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT h.event_num, h.round, h.heat_num, h.event_name,
           COUNT(a.id)::int AS athlete_count
    FROM heats h
    LEFT JOIN athletes a ON a.heat_id = h.id
    WHERE h.meet_id = ${meetId}
      AND h.status  = 'published'
    GROUP BY h.event_num, h.round, h.heat_num, h.event_name
    ORDER BY
      NULLIF(regexp_replace(h.event_num, '[^0-9]', '', 'g'), '')::int NULLS LAST,
      h.event_num, h.round, h.heat_num
  `
  return rows as MeetEvent[]
}

/** All athletes in one published heat, ordered by place — browse-by-event. */
export async function listAthletesByEvent(
  meetId:   string,
  eventNum: string,
  round?:   string | null,
  heatNum?: string | null,
): Promise<AthleteWithContext[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      a.*,
      h.id            AS heat_id_,
      h.meet_id       AS heat_meet_id,
      h.event_num     AS heat_event_num,
      h.round         AS heat_round,
      h.heat_num      AS heat_heat_num,
      h.event_name    AS heat_event_name,
      h.image_path    AS heat_image_path,
      h.image_width   AS heat_image_width,
      h.image_height  AS heat_image_height,
      h.first_frame_time AS heat_first_frame_time,
      h.last_frame_time  AS heat_last_frame_time,
      h.status        AS heat_status,
      h.created_at    AS heat_created_at,
      m.id            AS meet_id_,
      m.name          AS meet_name,
      m.date          AS meet_date,
      m.location      AS meet_location,
      m.company_name  AS meet_company_name,
      m.created_at    AS meet_created_at
    FROM athletes a
    JOIN heats h ON h.id = a.heat_id
    JOIN meets  m ON m.id = h.meet_id
    WHERE
      h.status = 'published'
      AND m.id = ${meetId}
      AND h.event_num = ${eventNum}
      AND (${round ?? null}::text   IS NULL OR h.round    = ${round ?? null})
      AND (${heatNum ?? null}::text IS NULL OR h.heat_num = ${heatNum ?? null})
    ORDER BY a.place ASC NULLS LAST, a.finish_time ASC NULLS LAST
    LIMIT 100
  `
  return rows.map(rowToAthleteWithContext)
}

// ---------------------------------------------------------------------------
// Row mapping helpers
// ---------------------------------------------------------------------------

function rowToAthleteWithContext(row: Record<string, unknown>): AthleteWithContext {
  const athlete: Athlete = {
    id:          row.id          as string,
    heat_id:     row.heat_id     as string,
    bib:         row.bib         as string,
    first_name:  row.first_name  as string,
    last_name:   row.last_name   as string,
    team:        row.team        as string | null,
    finish_time: row.finish_time as number | null,
    place:       row.place       as number | null,
    image_path:  row.image_path  as string | null,
    video_path:  row.video_path  as string | null,
    frames_dir:  row.frames_dir  as string | null,
    frame_count: row.frame_count as number | null,
    created_at:  row.created_at  as string,
  }
  const heat: Heat & { meet: Meet } = {
    id:               row.heat_id     as string,
    meet_id:          row.heat_meet_id as string,
    event_num:        row.heat_event_num as string,
    round:            row.heat_round   as string,
    heat_num:         row.heat_heat_num as string,
    event_name:       row.heat_event_name as string | null,
    image_path:       row.heat_image_path as string | null,
    image_width:      row.heat_image_width as number | null,
    image_height:     row.heat_image_height as number | null,
    first_frame_time: row.heat_first_frame_time as number | null,
    last_frame_time:  row.heat_last_frame_time  as number | null,
    status:           (row.heat_status as 'draft' | 'published' | 'hidden') ?? undefined,
    created_at:       row.heat_created_at as string,
    meet: {
      id:           row.meet_id_       as string,
      name:         row.meet_name      as string,
      date:         row.meet_date      as string,
      location:     row.meet_location  as string | null,
      company_name: row.meet_company_name as string | null,
      created_at:   row.meet_created_at as string,
    },
  }
  return { ...athlete, heat }
}

// ---------------------------------------------------------------------------
// Admin utilities
// ---------------------------------------------------------------------------

export async function getAllMeetsWithHeats(): Promise<MeetWithHeats[]> {
  const sql = getDb()

  const meetRows = await sql`SELECT * FROM meets ORDER BY created_at DESC`
  const heatRows = await sql`SELECT * FROM heats ORDER BY created_at ASC`
  const athleteRows = await sql`SELECT * FROM athletes`

  return (meetRows as Meet[]).map((meet) => {
    const heats = (heatRows as Heat[])
      .filter((h) => h.meet_id === meet.id)
      .map((heat) => ({
        ...heat,
        athletes: (athleteRows as Athlete[]).filter((a) => a.heat_id === heat.id),
      }))
    return { ...meet, heats }
  })
}

// ---------------------------------------------------------------------------
// Purchase protection — "download links never expire"
//
// An athlete is protected from deletion when they have a PAID purchase or
// order item in either system, or a PENDING one younger than the grace window
// (a checkout in flight — deleting mid-payment would charge the customer for
// nothing). Deleting an athlete row would CASCADE their purchases/order_items
// away, so every delete path (manual + cleanup) must consult this.
// ---------------------------------------------------------------------------

const PENDING_GRACE_HOURS = 24

/** IDs (among the given set) of athletes protected by a purchase/order. */
async function protectedIdsAmong(athleteIds: string[]): Promise<Set<string>> {
  if (!athleteIds.length) return new Set()
  const sql = getDb()
  const cutoff = new Date(Date.now() - PENDING_GRACE_HOURS * 3600 * 1000).toISOString()

  try {
    const rows = await sql`
      SELECT DISTINCT a.id
      FROM athletes a
      WHERE a.id = ANY(${athleteIds})
        AND (
          EXISTS (SELECT 1 FROM purchases p
                  WHERE p.athlete_id = a.id
                    AND (p.status = 'paid'
                         OR (p.status = 'pending' AND p.created_at > ${cutoff})))
          OR EXISTS (SELECT 1 FROM order_items oi
                     JOIN orders o ON o.id = oi.order_id
                     WHERE oi.athlete_id = a.id
                       AND (o.status = 'paid'
                            OR (o.status = 'pending' AND o.created_at > ${cutoff})))
        )
    `
    return new Set((rows as Array<{ id: string }>).map(r => r.id))
  } catch (err) {
    // orders/order_items tables may not exist yet (migration not run) —
    // fall back to purchases-only rather than failing the whole delete
    console.error('protectedIdsAmong: order tables unavailable, falling back to purchases only:', err)
    const rows = await sql`
      SELECT DISTINCT a.id
      FROM athletes a
      WHERE a.id = ANY(${athleteIds})
        AND EXISTS (SELECT 1 FROM purchases p
                    WHERE p.athlete_id = a.id
                      AND (p.status = 'paid'
                           OR (p.status = 'pending' AND p.created_at > ${cutoff})))
    `
    return new Set((rows as Array<{ id: string }>).map(r => r.id))
  }
}

/** Delete blob files + rows for the given athletes (already vetted as unprotected). */
async function deleteAthleteRows(athletes: Athlete[]): Promise<void> {
  if (!athletes.length) return
  const sql = getDb()
  const { deleteAthleteFiles } = await import('./blob-storage')
  await Promise.all(athletes.map(a =>
    deleteAthleteFiles(a.image_path, a.frames_dir, a.frame_count).catch(() => {}),
  ))
  await sql`DELETE FROM athletes WHERE id = ANY(${athletes.map(a => a.id)})`
}

export interface DeleteResult {
  found: boolean
  /** Athletes kept because a purchase protects them (container rows kept too). */
  keptAthletes: number
}

export async function deleteHeat(heatId: string): Promise<DeleteResult> {
  const sql = getDb()

  const heat = await sql`SELECT * FROM heats WHERE id = ${heatId} LIMIT 1`
  if (!heat.length) return { found: false, keptAthletes: 0 }

  const athletes = (await sql`SELECT * FROM athletes WHERE heat_id = ${heatId}`) as Athlete[]
  const kept = await protectedIdsAmong(athletes.map(a => a.id))

  await deleteAthleteRows(athletes.filter(a => !kept.has(a.id)))

  // Only remove the heat itself when no purchased athletes remain in it
  if (kept.size === 0) {
    await sql`DELETE FROM heats WHERE id = ${heatId}`
  }
  return { found: true, keptAthletes: kept.size }
}

export async function deleteMeet(meetId: string): Promise<DeleteResult> {
  const sql = getDb()

  const meet = await sql`SELECT * FROM meets WHERE id = ${meetId} LIMIT 1`
  if (!meet.length) return { found: false, keptAthletes: 0 }

  const athletes = (await sql`
    SELECT a.* FROM athletes a
    JOIN heats h ON h.id = a.heat_id
    WHERE h.meet_id = ${meetId}
  `) as Athlete[]
  const kept = await protectedIdsAmong(athletes.map(a => a.id))

  await deleteAthleteRows(athletes.filter(a => !kept.has(a.id)))

  if (kept.size === 0) {
    await sql`DELETE FROM meets WHERE id = ${meetId}`  // cascades to heats + athletes
  } else {
    // Purchased athletes remain — drop only the now-empty heats
    await sql`
      DELETE FROM heats h
      WHERE h.meet_id = ${meetId}
        AND NOT EXISTS (SELECT 1 FROM athletes a WHERE a.heat_id = h.id)
    `
  }
  return { found: true, keptAthletes: kept.size }
}

/**
 * Smart cleanup (FEATURES.md): for meets older than the cutoff, delete only
 * UNPURCHASED athletes (images + rows). Athletes with a paid legacy purchase
 * OR a paid v2 order item are kept forever — "download links never expire".
 * Heats/meets are removed only once they hold no remaining athletes.
 */
export async function cleanupOldMeets(daysOld: number): Promise<{
  deleted: number
  meets: string[]
  athletesDeleted: number
  athletesKept: number
  meetsTrimmed: string[]
}> {
  const sql = getDb()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysOld)
  const cutoffStr = cutoff.toISOString().slice(0, 10)  // YYYY-MM-DD

  const old = await sql`SELECT * FROM meets WHERE date < ${cutoffStr}`
  const deletedMeets: string[] = []
  const trimmedMeets: string[] = []
  let athletesDeleted = 0
  let athletesKept    = 0

  for (const meet of old as Meet[]) {
    const all = (await sql`
      SELECT a.* FROM athletes a
      JOIN heats h ON h.id = a.heat_id
      WHERE h.meet_id = ${meet.id}
    `) as Athlete[]

    // Protection covers paid rows AND fresh pending checkouts (grace window)
    const keptIds = await protectedIdsAmong(all.map(a => a.id))
    athletesKept += keptIds.size

    const toDelete = all.filter(a => !keptIds.has(a.id))
    await deleteAthleteRows(toDelete)
    athletesDeleted += toDelete.length

    // Drop heats that no longer hold any athletes
    await sql`
      DELETE FROM heats h
      WHERE h.meet_id = ${meet.id}
        AND NOT EXISTS (SELECT 1 FROM athletes a WHERE a.heat_id = h.id)
    `

    // Drop the meet itself once nothing remains
    if (keptIds.size === 0) {
      await sql`DELETE FROM meets WHERE id = ${meet.id}`
      deletedMeets.push(meet.name)
    } else {
      trimmedMeets.push(meet.name)
    }
  }

  return {
    deleted: deletedMeets.length,
    meets: deletedMeets,
    athletesDeleted,
    athletesKept,
    meetsTrimmed: trimmedMeets,
  }
}

// ---------------------------------------------------------------------------
// Local filesystem helpers (used only in dev / non-Blob mode)
// ---------------------------------------------------------------------------

export function imagePathForAthlete(
  meetId: string,
  heatId: string,
  lastName: string,
  firstName: string,
  bib?: string | null,
): string {
  const dir = path.join(IMAGES_DIR, meetId, heatId)
  fs.mkdirSync(dir, { recursive: true })
  const namePart = `${safeName(lastName)}-${safeName(firstName)}`
  const hasBib   = bib && bib !== '0'
  const filename = hasBib ? `${namePart}-${bib}.jpg` : `${namePart}.jpg`
  return path.join(dir, filename)
}

export function framesDirForAthlete(
  meetId: string,
  heatId: string,
  lastName: string,
  firstName: string,
  bib?: string | null,
): string {
  const namePart = `${safeName(lastName)}-${safeName(firstName)}`
  const hasBib   = bib && bib !== '0'
  const dirName  = hasBib ? `${namePart}-${bib}-frames` : `${namePart}-frames`
  const dir      = path.join(IMAGES_DIR, meetId, heatId, dirName)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}
