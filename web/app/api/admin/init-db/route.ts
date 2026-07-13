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
      tier                      TEXT NOT NULL CHECK (tier IN ('basic', 'enhanced', 'full')),
      stripe_session_id         TEXT UNIQUE NOT NULL,
      stripe_payment_intent_id  TEXT,
      email                     TEXT,
      amount_cents              INTEGER NOT NULL,
      status                    TEXT NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'paid')),
      created_at                TEXT NOT NULL
    )
  `

  // Migrate existing table: update tier check constraint to include 'enhanced'
  await sql`
    ALTER TABLE purchases
      DROP CONSTRAINT IF EXISTS purchases_tier_check
  `
  await sql`
    ALTER TABLE purchases
      ADD CONSTRAINT purchases_tier_check
        CHECK (tier IN ('basic', 'enhanced', 'full'))
  `

  await sql`
    CREATE INDEX IF NOT EXISTS purchases_athlete_id_idx
      ON purchases (athlete_id)
  `

  // -------------------------------------------------------------------------
  // v2: combined orders (multi-item cart). ADDITIVE — the legacy `purchases`
  // table above is untouched so pre-v2 download links keep working forever.
  // -------------------------------------------------------------------------
  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id                        TEXT PRIMARY KEY,
      order_number              TEXT UNIQUE,
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
    CREATE TABLE IF NOT EXISTS order_items (
      id           TEXT PRIMARY KEY,
      order_id     TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      athlete_id   TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
      bundle       TEXT NOT NULL
                     CHECK (bundle IN ('raw', 'photosocial', 'works', 'social')),
      config       JSONB,
      amount_cents INTEGER NOT NULL,
      created_at   TEXT NOT NULL
    )
  `

  await sql`
    CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items (order_id)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS order_items_athlete_id_idx ON order_items (athlete_id)
  `

  // Human-facing order numbers: FP-1001, FP-1002, …
  await sql`
    CREATE SEQUENCE IF NOT EXISTS fp_order_number_seq START 1001
  `

  // Unique indexes for race-condition-safe upserts.
  // De-duplicate before adding — keep the oldest row in each duplicate group
  // and remap any children to it, then drop the extras.
  await sql`
    WITH dupes AS (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY name, date ORDER BY created_at) AS rn
      FROM meets
    ),
    keeper AS (
      SELECT DISTINCT ON (name, date) id AS keep_id, name, date
      FROM meets ORDER BY name, date, created_at
    )
    UPDATE heats
    SET meet_id = keeper.keep_id
    FROM keeper
    JOIN meets ON meets.name = keeper.name AND meets.date = keeper.date
    WHERE heats.meet_id = meets.id
      AND meets.id <> keeper.keep_id
  `
  await sql`
    DELETE FROM meets
    WHERE id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY name, date ORDER BY created_at) AS rn
        FROM meets
      ) t WHERE rn > 1
    )
  `
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS meets_name_date_idx ON meets (name, date)
  `

  await sql`
    WITH keeper AS (
      SELECT DISTINCT ON (meet_id, event_num, round, heat_num) id AS keep_id,
             meet_id, event_num, round, heat_num
      FROM heats ORDER BY meet_id, event_num, round, heat_num, created_at
    )
    UPDATE athletes
    SET heat_id = keeper.keep_id
    FROM keeper
    JOIN heats ON heats.meet_id = keeper.meet_id
              AND heats.event_num = keeper.event_num
              AND heats.round = keeper.round
              AND heats.heat_num = keeper.heat_num
    WHERE athletes.heat_id = heats.id
      AND heats.id <> keeper.keep_id
  `
  await sql`
    DELETE FROM heats
    WHERE id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY meet_id, event_num, round, heat_num ORDER BY created_at) AS rn
        FROM heats
      ) t WHERE rn > 1
    )
  `
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS heats_meet_event_round_heat_idx
      ON heats (meet_id, event_num, round, heat_num)
  `

  return NextResponse.json({ ok: true, message: 'Database schema initialised' })
}
