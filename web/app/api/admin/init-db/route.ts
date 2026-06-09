import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { requireAdmin } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const authError = requireAdmin(request)
  if (authError) return authError

  const sql = neon(process.env.DATABASE_URL!)

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
      meet_id          TEXT NOT NULL REFERENCES meets(id) ON DELETE CASCADE,
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
      heat_id     TEXT NOT NULL REFERENCES heats(id) ON DELETE CASCADE,
      bib         TEXT NOT NULL,
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

  await sql`
    CREATE TABLE IF NOT EXISTS purchases (
      id                        TEXT PRIMARY KEY,
      athlete_id                TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
      tier                      TEXT NOT NULL CHECK (tier IN ('basic', 'full')),
      stripe_session_id         TEXT UNIQUE NOT NULL,
      stripe_payment_intent_id  TEXT,
      email                     TEXT,
      amount_cents              INTEGER NOT NULL,
      status                    TEXT NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'paid')),
      created_at                TEXT NOT NULL
    )
  `

  await sql`
    CREATE INDEX IF NOT EXISTS purchases_athlete_id_idx
      ON purchases (athlete_id)
  `

  return NextResponse.json({ ok: true, message: 'Database schema initialised' })
}
