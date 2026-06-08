/**
 * database.ts — Dual-mode data layer.
 *
 * When POSTGRES_URL is set (Vercel production): uses @vercel/postgres.
 * Otherwise (local dev): uses a local JSON file.
 *
 * All exported functions are async — callers must await them.
 */

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

// ---------------------------------------------------------------------------
// Environment flags
// ---------------------------------------------------------------------------

const IS_PG   = () => !!process.env.POSTGRES_URL
const IS_BLOB = () => !!process.env.BLOB_READ_WRITE_TOKEN

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

/** Returns the effective status for a heat, defaulting existing heats to 'published'. */
export function effectiveStatus(heat: Heat): 'draft' | 'published' | 'hidden' {
  return heat.status ?? 'published'
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

function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'unknown'
}

// ---------------------------------------------------------------------------
// JSON file helpers (local dev)
// ---------------------------------------------------------------------------

export const DATA_DIR   = process.env.DATA_DIR ?? path.resolve(process.cwd(), '..', 'data')
export const IMAGES_DIR = path.join(DATA_DIR, 'images')
export const DB_PATH    = path.join(DATA_DIR, 'db.json')

interface DB { meets: Meet[]; heats: Heat[]; athletes: Athlete[] }

function readDb(): DB {
  if (!fs.existsSync(DB_PATH)) return { meets: [], heats: [], athletes: [] }
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')) as DB }
  catch { return { meets: [], heats: [], athletes: [] } }
}

function writeDb(db: DB): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8')
}

// ---------------------------------------------------------------------------
// Postgres table initialisation (runs once per serverless cold-start)
// ---------------------------------------------------------------------------

let _pgInitPromise: Promise<void> | null = null

async function ensurePgTables(): Promise<void> {
  if (_pgInitPromise) return _pgInitPromise
  _pgInitPromise = (async () => {
    const { sql } = await import('@vercel/postgres')
    await sql`
      CREATE TABLE IF NOT EXISTS meets (
        id           TEXT PRIMARY KEY,
        name         TEXT NOT NULL,
        date         TEXT NOT NULL,
        location     TEXT,
        company_name TEXT,
        created_at   TEXT NOT NULL
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS heats (
        id               TEXT PRIMARY KEY,
        meet_id          TEXT NOT NULL,
        event_num        TEXT NOT NULL,
        round            TEXT NOT NULL,
        heat_num         TEXT NOT NULL,
        event_name       TEXT,
        image_path       TEXT,
        image_width      INTEGER,
        image_height     INTEGER,
        first_frame_time REAL,
        last_frame_time  REAL,
        status           TEXT DEFAULT 'draft',
        created_at       TEXT NOT NULL
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS athletes (
        id          TEXT PRIMARY KEY,
        heat_id     TEXT NOT NULL,
        bib         TEXT NOT NULL DEFAULT '',
        first_name  TEXT NOT NULL,
        last_name   TEXT NOT NULL,
        team        TEXT,
        finish_time REAL,
        place       INTEGER,
        image_path  TEXT,
        video_path  TEXT,
        frames_dir  TEXT,
        frame_count INTEGER,
        created_at  TEXT NOT NULL
      )
    `
  })()
  return _pgInitPromise
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
  if (IS_PG()) {
    const { sql } = await import('@vercel/postgres')
    await ensurePgTables()
    const { rows } = await sql<Meet>`SELECT * FROM meets WHERE name = ${name} AND date = ${date} LIMIT 1`
    if (rows.length > 0) {
      const existing = rows[0]
      let loc = existing.location
      let co  = existing.company_name
      let dirty = false
      if (location && location !== loc)         { loc = location;    dirty = true }
      if (companyName && companyName !== co)    { co  = companyName; dirty = true }
      if (dirty) {
        await sql`UPDATE meets SET location = ${loc}, company_name = ${co} WHERE id = ${existing.id}`
        return { ...existing, location: loc, company_name: co }
      }
      return existing
    }
    const id = uuid(); const createdAt = now()
    await sql`
      INSERT INTO meets (id, name, date, location, company_name, created_at)
      VALUES (${id}, ${name}, ${date}, ${location ?? null}, ${companyName ?? null}, ${createdAt})
    `
    return { id, name, date, location: location ?? null, company_name: companyName ?? null, created_at: createdAt }
  }

  const db = readDb()
  const existing = db.meets.find((m) => m.name === name && m.date === date)
  if (existing) {
    let dirty = false
    if (location    && location    !== existing.location)     { existing.location     = location;    dirty = true }
    if (companyName && companyName !== existing.company_name) { existing.company_name = companyName; dirty = true }
    if (dirty) writeDb(db)
    return existing
  }
  const meet: Meet = { id: uuid(), name, date, location: location ?? null, company_name: companyName ?? null, created_at: now() }
  db.meets.push(meet)
  writeDb(db)
  return meet
}

export async function getRecentMeets(limit = 10): Promise<Meet[]> {
  if (IS_PG()) {
    const { sql } = await import('@vercel/postgres')
    await ensurePgTables()
    const { rows } = await sql<Meet>`SELECT * FROM meets ORDER BY created_at DESC LIMIT ${limit}`
    return rows
  }
  return [...readDb().meets].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit)
}

// ---------------------------------------------------------------------------
// Heats
// ---------------------------------------------------------------------------

export async function createHeat(data: Omit<Heat, 'id' | 'created_at'>): Promise<Heat> {
  if (IS_PG()) {
    const { sql } = await import('@vercel/postgres')
    await ensurePgTables()
    const id = uuid(); const createdAt = now()
    await sql`
      INSERT INTO heats (id, meet_id, event_num, round, heat_num, event_name, image_path,
        image_width, image_height, first_frame_time, last_frame_time, status, created_at)
      VALUES (${id}, ${data.meet_id}, ${data.event_num}, ${data.round}, ${data.heat_num},
        ${data.event_name ?? null}, ${data.image_path ?? null}, ${data.image_width ?? null},
        ${data.image_height ?? null}, ${data.first_frame_time ?? null}, ${data.last_frame_time ?? null},
        ${data.status ?? 'draft'}, ${createdAt})
    `
    return { id, created_at: createdAt, ...data }
  }
  const db = readDb()
  const heat: Heat = { id: uuid(), created_at: now(), ...data }
  db.heats.push(heat)
  writeDb(db)
  return heat
}

export async function getHeat(id: string): Promise<Heat | null> {
  if (IS_PG()) {
    const { sql } = await import('@vercel/postgres')
    await ensurePgTables()
    const { rows } = await sql<Heat>`SELECT * FROM heats WHERE id = ${id} LIMIT 1`
    return rows[0] ?? null
  }
  return readDb().heats.find((h) => h.id === id) ?? null
}

export async function findOrCreateHeat(
  meetId: string,
  eventNum: string,
  round: string,
  heatNum: string,
  eventName?: string | null,
): Promise<Heat> {
  if (IS_PG()) {
    const { sql } = await import('@vercel/postgres')
    await ensurePgTables()
    const { rows } = await sql<Heat>`
      SELECT * FROM heats
      WHERE meet_id = ${meetId} AND event_num = ${eventNum} AND round = ${round} AND heat_num = ${heatNum}
      LIMIT 1
    `
    if (rows.length > 0) return rows[0]
    const id = uuid(); const createdAt = now()
    await sql`
      INSERT INTO heats (id, meet_id, event_num, round, heat_num, event_name,
        image_path, image_width, image_height, first_frame_time, last_frame_time, status, created_at)
      VALUES (${id}, ${meetId}, ${eventNum}, ${round}, ${heatNum}, ${eventName ?? null},
        ${null}, ${null}, ${null}, ${null}, ${null}, 'draft', ${createdAt})
    `
    return {
      id, created_at: createdAt, meet_id: meetId, event_num: eventNum, round, heat_num: heatNum,
      event_name: eventName ?? null, image_path: null, image_width: null, image_height: null,
      first_frame_time: null, last_frame_time: null, status: 'draft',
    }
  }

  const db = readDb()
  const existing = db.heats.find(
    (h) => h.meet_id === meetId && h.event_num === eventNum && h.round === round && h.heat_num === heatNum,
  )
  if (existing) return existing
  const heat: Heat = {
    id: uuid(), created_at: now(), meet_id: meetId, event_num: eventNum, round, heat_num: heatNum,
    event_name: eventName ?? null, image_path: null, image_width: null, image_height: null,
    first_frame_time: null, last_frame_time: null, status: 'draft',
  }
  db.heats.push(heat)
  writeDb(db)
  return heat
}

// ---------------------------------------------------------------------------
// Athletes
// ---------------------------------------------------------------------------

export async function createAthlete(data: Omit<Athlete, 'id' | 'created_at'>): Promise<Athlete> {
  if (IS_PG()) {
    const { sql } = await import('@vercel/postgres')
    await ensurePgTables()
    const id = uuid(); const createdAt = now()
    await sql`
      INSERT INTO athletes (id, heat_id, bib, first_name, last_name, team, finish_time, place,
        image_path, video_path, frames_dir, frame_count, created_at)
      VALUES (${id}, ${data.heat_id}, ${data.bib}, ${data.first_name}, ${data.last_name},
        ${data.team ?? null}, ${data.finish_time ?? null}, ${data.place ?? null},
        ${data.image_path ?? null}, ${data.video_path ?? null}, ${data.frames_dir ?? null},
        ${data.frame_count ?? null}, ${createdAt})
    `
    return { id, created_at: createdAt, ...data }
  }
  const db = readDb()
  const athlete: Athlete = { id: uuid(), created_at: now(), ...data }
  db.athletes.push(athlete)
  writeDb(db)
  return athlete
}

export async function upsertAthlete(data: Omit<Athlete, 'id' | 'created_at'>): Promise<Athlete> {
  if (IS_PG()) {
    const { sql } = await import('@vercel/postgres')
    await ensurePgTables()
    const noBib = !data.bib || data.bib === '0'
    const { rows } = noBib
      ? await sql<Athlete>`
          SELECT * FROM athletes
          WHERE heat_id = ${data.heat_id}
            AND LOWER(first_name) = LOWER(${data.first_name})
            AND LOWER(last_name)  = LOWER(${data.last_name})
          LIMIT 1
        `
      : await sql<Athlete>`
          SELECT * FROM athletes WHERE heat_id = ${data.heat_id} AND bib = ${data.bib} LIMIT 1
        `

    if (rows.length > 0) {
      const existing = rows[0]
      await sql`
        UPDATE athletes SET
          bib         = ${data.bib},
          first_name  = ${data.first_name},
          last_name   = ${data.last_name},
          team        = ${data.team ?? null},
          finish_time = ${data.finish_time ?? null},
          place       = ${data.place ?? null},
          image_path  = ${data.image_path ?? null},
          video_path  = ${data.video_path ?? null},
          frames_dir  = ${data.frames_dir ?? null},
          frame_count = ${data.frame_count ?? null}
        WHERE id = ${existing.id}
      `
      return { ...existing, ...data }
    }
    return createAthlete(data)
  }

  const db = readDb()
  const noBib = !data.bib || data.bib === '0'
  const existing = db.athletes.find((a) =>
    noBib
      ? a.heat_id === data.heat_id &&
        a.first_name.toLowerCase() === data.first_name.toLowerCase() &&
        a.last_name.toLowerCase() === data.last_name.toLowerCase()
      : a.heat_id === data.heat_id && a.bib === data.bib,
  )
  if (existing) { Object.assign(existing, data); writeDb(db); return existing }
  const athlete: Athlete = { id: uuid(), created_at: now(), ...data }
  db.athletes.push(athlete)
  writeDb(db)
  return athlete
}

export async function getAthlete(id: string): Promise<Athlete | null> {
  if (IS_PG()) {
    const { sql } = await import('@vercel/postgres')
    await ensurePgTables()
    const { rows } = await sql<Athlete>`SELECT * FROM athletes WHERE id = ${id} LIMIT 1`
    return rows[0] ?? null
  }
  return readDb().athletes.find((a) => a.id === id) ?? null
}

export async function getAthleteWithContext(id: string): Promise<AthleteWithContext | null> {
  if (IS_PG()) {
    const { sql } = await import('@vercel/postgres')
    await ensurePgTables()
    const { rows } = await sql`
      SELECT
        a.id, a.heat_id, a.bib, a.first_name, a.last_name, a.team, a.finish_time, a.place,
        a.image_path, a.video_path, a.frames_dir, a.frame_count, a.created_at,
        h.id           AS h_id,
        h.meet_id,
        h.event_num,
        h.round,
        h.heat_num,
        h.event_name,
        h.image_path   AS h_image_path,
        h.image_width,
        h.image_height,
        h.first_frame_time,
        h.last_frame_time,
        h.status,
        h.created_at   AS h_created_at,
        m.id           AS m_id,
        m.name         AS m_name,
        m.date,
        m.location,
        m.company_name,
        m.created_at   AS m_created_at
      FROM athletes a
      JOIN heats h ON h.id = a.heat_id
      JOIN meets  m ON m.id = h.meet_id
      WHERE a.id = ${id}
      LIMIT 1
    `
    if (rows.length === 0) return null
    const r = rows[0]
    return {
      id: r.id, heat_id: r.heat_id, bib: r.bib,
      first_name: r.first_name, last_name: r.last_name,
      team: r.team, finish_time: r.finish_time, place: r.place,
      image_path: r.image_path, video_path: r.video_path,
      frames_dir: r.frames_dir, frame_count: r.frame_count, created_at: r.created_at,
      heat: {
        id: r.h_id, meet_id: r.meet_id, event_num: r.event_num, round: r.round,
        heat_num: r.heat_num, event_name: r.event_name, image_path: r.h_image_path,
        image_width: r.image_width, image_height: r.image_height,
        first_frame_time: r.first_frame_time, last_frame_time: r.last_frame_time,
        status: r.status, created_at: r.h_created_at,
        meet: {
          id: r.m_id, name: r.m_name, date: r.date, location: r.location,
          company_name: r.company_name, created_at: r.m_created_at,
        },
      },
    }
  }

  const db = readDb()
  const athlete = db.athletes.find((a) => a.id === id)
  if (!athlete) return null
  const heat = db.heats.find((h) => h.id === athlete.heat_id)
  if (!heat) return null
  const meet = db.meets.find((m) => m.id === heat.meet_id)
  if (!meet) return null
  return { ...athlete, heat: { ...heat, meet } }
}

export async function searchAthletes(query: string, limit = 20): Promise<AthleteWithContext[]> {
  const q = query.toLowerCase().trim()

  if (IS_PG()) {
    const { sql } = await import('@vercel/postgres')
    await ensurePgTables()
    const like = `%${q}%`
    const { rows } = await sql`
      SELECT
        a.id, a.heat_id, a.bib, a.first_name, a.last_name, a.team, a.finish_time, a.place,
        a.image_path, a.video_path, a.frames_dir, a.frame_count, a.created_at,
        h.id           AS h_id,
        h.meet_id,
        h.event_num,
        h.round,
        h.heat_num,
        h.event_name,
        h.image_path   AS h_image_path,
        h.image_width,
        h.image_height,
        h.first_frame_time,
        h.last_frame_time,
        h.status,
        h.created_at   AS h_created_at,
        m.id           AS m_id,
        m.name         AS m_name,
        m.date,
        m.location,
        m.company_name,
        m.created_at   AS m_created_at
      FROM athletes a
      JOIN heats h ON h.id = a.heat_id
      JOIN meets  m ON m.id = h.meet_id
      WHERE
        (LOWER(a.first_name) LIKE ${like}
         OR LOWER(a.last_name) LIKE ${like}
         OR LOWER(a.bib) = ${q})
        AND (h.status = 'published' OR h.status IS NULL)
      ORDER BY a.created_at DESC
      LIMIT ${limit}
    `
    return rows.map((r: Record<string, unknown>) => ({
      id: r.id as string, heat_id: r.heat_id as string, bib: r.bib as string,
      first_name: r.first_name as string, last_name: r.last_name as string,
      team: r.team as string | null, finish_time: r.finish_time as number | null,
      place: r.place as number | null, image_path: r.image_path as string | null,
      video_path: r.video_path as string | null, frames_dir: r.frames_dir as string | null,
      frame_count: r.frame_count as number | null, created_at: r.created_at as string,
      heat: {
        id: r.h_id as string, meet_id: r.meet_id as string,
        event_num: r.event_num as string, round: r.round as string,
        heat_num: r.heat_num as string, event_name: r.event_name as string | null,
        image_path: r.h_image_path as string | null,
        image_width: r.image_width as number | null,
        image_height: r.image_height as number | null,
        first_frame_time: r.first_frame_time as number | null,
        last_frame_time: r.last_frame_time as number | null,
        status: r.status as 'draft' | 'published' | 'hidden' | undefined,
        created_at: r.h_created_at as string,
        meet: {
          id: r.m_id as string, name: r.m_name as string, date: r.date as string,
          location: r.location as string | null, company_name: r.company_name as string | null,
          created_at: r.m_created_at as string,
        },
      },
    }))
  }

  const db = readDb()
  return db.athletes
    .filter((a) =>
      a.first_name.toLowerCase().includes(q) ||
      a.last_name.toLowerCase().includes(q) ||
      a.bib.toLowerCase() === q,
    )
    .map((athlete) => {
      const heat = db.heats.find((h) => h.id === athlete.heat_id)!
      const meet = db.meets.find((m) => m.id === heat?.meet_id)!
      return { ...athlete, heat: { ...heat, meet } }
    })
    .filter((a) => a.heat && a.heat.meet && effectiveStatus(a.heat) === 'published')
    .slice(0, limit)
}

// ---------------------------------------------------------------------------
// Admin utilities
// ---------------------------------------------------------------------------

export async function updateHeatStatus(
  heatId: string,
  status: 'draft' | 'published' | 'hidden',
): Promise<Heat | null> {
  if (IS_PG()) {
    const { sql } = await import('@vercel/postgres')
    await ensurePgTables()
    const { rows } = await sql<Heat>`UPDATE heats SET status = ${status} WHERE id = ${heatId} RETURNING *`
    return rows[0] ?? null
  }
  const db = readDb()
  const heat = db.heats.find((h) => h.id === heatId)
  if (!heat) return null
  heat.status = status
  writeDb(db)
  return heat
}

export async function getAllMeetsWithHeats(): Promise<MeetWithHeats[]> {
  if (IS_PG()) {
    const { sql } = await import('@vercel/postgres')
    await ensurePgTables()
    const { rows: meets }    = await sql<Meet>`SELECT * FROM meets ORDER BY created_at DESC`
    const { rows: heats }    = await sql<Heat>`SELECT * FROM heats ORDER BY CAST(event_num AS INTEGER) ASC, CAST(heat_num AS INTEGER) ASC`
    const { rows: athletes } = await sql<Athlete>`SELECT * FROM athletes`
    return meets.map((meet) => ({
      ...meet,
      heats: heats
        .filter((h) => h.meet_id === meet.id)
        .map((heat) => ({ ...heat, athletes: athletes.filter((a) => a.heat_id === heat.id) })),
    }))
  }

  const db = readDb()
  return [...db.meets]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((meet) => ({
      ...meet,
      heats: db.heats
        .filter((h) => h.meet_id === meet.id)
        .sort((a, b) => {
          const en = Number(a.event_num) - Number(b.event_num)
          return en !== 0 ? en : Number(a.heat_num) - Number(b.heat_num)
        })
        .map((heat) => ({ ...heat, athletes: db.athletes.filter((a) => a.heat_id === heat.id) })),
    }))
}

export async function deleteHeat(heatId: string): Promise<boolean> {
  const { deleteAthleteFiles } = await import('./blob-storage')

  if (IS_PG()) {
    const { sql } = await import('@vercel/postgres')
    await ensurePgTables()
    const { rows: athletes } = await sql<Athlete>`SELECT * FROM athletes WHERE heat_id = ${heatId}`
    for (const a of athletes) await deleteAthleteFiles(a.image_path, a.frames_dir, a.frame_count)
    await sql`DELETE FROM athletes WHERE heat_id = ${heatId}`
    const { rowCount } = await sql`DELETE FROM heats WHERE id = ${heatId}`
    return (rowCount ?? 0) > 0
  }

  const db = readDb()
  const heat = db.heats.find((h) => h.id === heatId)
  if (!heat) return false
  const athletes = db.athletes.filter((a) => a.heat_id === heatId)
  for (const a of athletes) await deleteAthleteFiles(a.image_path, a.frames_dir, a.frame_count)
  if (heat.image_path && fs.existsSync(heat.image_path)) {
    try { fs.unlinkSync(heat.image_path) } catch { /* ignore */ }
  }
  db.athletes = db.athletes.filter((a) => a.heat_id !== heatId)
  db.heats    = db.heats.filter((h) => h.id !== heatId)
  writeDb(db)
  return true
}

export async function deleteMeet(meetId: string): Promise<boolean> {
  const { deleteAthleteFiles } = await import('./blob-storage')

  if (IS_PG()) {
    const { sql } = await import('@vercel/postgres')
    await ensurePgTables()
    const { rows: heats }    = await sql<Heat>`SELECT id FROM heats WHERE meet_id = ${meetId}`
    const heatIds = heats.map((h) => h.id)
    if (heatIds.length > 0) {
      const { rows: athletes } = await sql<Athlete>`
        SELECT * FROM athletes WHERE heat_id = ANY(${heatIds as unknown as string})
      `
      for (const a of athletes) await deleteAthleteFiles(a.image_path, a.frames_dir, a.frame_count)
      await sql`DELETE FROM athletes WHERE heat_id = ANY(${heatIds as unknown as string})`
    }
    await sql`DELETE FROM heats WHERE meet_id = ${meetId}`
    const { rowCount } = await sql`DELETE FROM meets WHERE id = ${meetId}`
    return (rowCount ?? 0) > 0
  }

  const db = readDb()
  if (!db.meets.find((m) => m.id === meetId)) return false
  const heatIds = db.heats.filter((h) => h.meet_id === meetId).map((h) => h.id)
  const athletes = db.athletes.filter((a) => heatIds.includes(a.heat_id))
  for (const a of athletes) await deleteAthleteFiles(a.image_path, a.frames_dir, a.frame_count)

  const meetImgDir = path.join(IMAGES_DIR, meetId)
  if (!IS_BLOB() && fs.existsSync(meetImgDir)) {
    try { fs.rmSync(meetImgDir, { recursive: true, force: true }) } catch { /* ignore */ }
  }

  db.athletes = db.athletes.filter((a) => !heatIds.includes(a.heat_id))
  db.heats    = db.heats.filter((h) => h.meet_id !== meetId)
  db.meets    = db.meets.filter((m) => m.id !== meetId)
  writeDb(db)
  return true
}

export async function cleanupOldMeets(daysOld: number): Promise<{ deleted: number; meets: string[] }> {
  if (IS_PG()) {
    const { sql } = await import('@vercel/postgres')
    await ensurePgTables()
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - daysOld)
    const cutoffStr = cutoff.toISOString().slice(0, 10) // YYYY-MM-DD
    const { rows } = await sql<Meet>`SELECT * FROM meets WHERE date < ${cutoffStr}`
    const deleted: string[] = []
    for (const meet of rows) {
      if (await deleteMeet(meet.id)) deleted.push(meet.name)
    }
    return { deleted: deleted.length, meets: deleted }
  }

  const db = readDb()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysOld)
  const toDelete = db.meets.filter((m) => new Date(m.date + 'T00:00:00') < cutoff)
  const deleted: string[] = []
  for (const meet of toDelete) {
    if (await deleteMeet(meet.id)) deleted.push(meet.name)
  }
  return { deleted: deleted.length, meets: deleted }
}

// ---------------------------------------------------------------------------
// Local filesystem path helpers (used in dev only — Blob uses blob-storage.ts)
// ---------------------------------------------------------------------------

export function imagePathForHeat(meetId: string, eventNum: string, round: string, heatNum: string): string {
  const dir = path.join(IMAGES_DIR, meetId)
  fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, `${eventNum}-${round}-${heatNum}.jpg`)
}

export function imagePathForAthlete(
  meetId: string, heatId: string, lastName: string, firstName: string, bib?: string | null,
): string {
  const dir = path.join(IMAGES_DIR, meetId, heatId)
  fs.mkdirSync(dir, { recursive: true })
  const namePart = `${safeName(lastName)}-${safeName(firstName)}`
  const hasBib   = bib && bib !== '0'
  return path.join(dir, hasBib ? `${namePart}-${bib}.jpg` : `${namePart}.jpg`)
}

export function framesDirForAthlete(
  meetId: string, heatId: string, lastName: string, firstName: string, bib?: string | null,
): string {
  const namePart = `${safeName(lastName)}-${safeName(firstName)}`
  const hasBib   = bib && bib !== '0'
  const dirName  = hasBib ? `${namePart}-${bib}-frames` : `${namePart}-frames`
  const dir      = path.join(IMAGES_DIR, meetId, heatId, dirName)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function videoPathForAthlete(
  meetId: string, heatId: string, lastName: string, firstName: string, bib?: string | null,
): string {
  const dir = path.join(IMAGES_DIR, meetId, heatId)
  fs.mkdirSync(dir, { recursive: true })
  const namePart = `${safeName(lastName)}-${safeName(firstName)}`
  const hasBib   = bib && bib !== '0'
  return path.join(dir, hasBib ? `${namePart}-${bib}.avi` : `${namePart}.avi`)
}
