import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { requireAdmin } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authError = requireAdmin(request)
  if (authError) return authError

  const sql = neon(process.env.DATABASE_URL!)
  const meets   = await sql`SELECT id, name, date FROM meets`
  const heats   = await sql`SELECT id, meet_id, event_num, round, heat_num, status FROM heats`
  const athletes = await sql`SELECT id, heat_id, first_name, last_name FROM athletes LIMIT 20`

  return NextResponse.json({ meets, heats, athletes })
}
