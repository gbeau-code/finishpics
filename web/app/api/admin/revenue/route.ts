import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { requireAdmin } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TRIANGLE_TIMING = 'Triangle Timing'
const ROYALTY_RATE    = 0.15   // 15% kept by platform for Triangle Timing meets

export async function GET(request: NextRequest) {
  const authError = requireAdmin(request)
  if (authError) return authError

  const sql = neon(process.env.DATABASE_URL!)

  const rows = await sql`
    SELECT
      m.id,
      m.name,
      m.date,
      m.company_name,
      COUNT(p.id)::int          AS sale_count,
      COALESCE(SUM(p.amount_cents), 0)::int AS total_cents
    FROM meets m
    LEFT JOIN heats    h ON h.meet_id    = m.id
    LEFT JOIN athletes a ON a.heat_id    = h.id
    LEFT JOIN purchases p ON p.athlete_id = a.id AND p.status = 'paid'
    GROUP BY m.id, m.name, m.date, m.company_name
    ORDER BY m.date DESC, m.name
  `

  const meets = rows.map((r) => {
    const isTriangle   = r.company_name === TRIANGLE_TIMING
    const platformCuts = isTriangle ? Math.round(r.total_cents * ROYALTY_RATE) : r.total_cents
    const partnerCuts  = isTriangle ? r.total_cents - platformCuts : 0
    return {
      id:           r.id,
      name:         r.name,
      date:         r.date,
      company_name: r.company_name ?? null,
      sale_count:   r.sale_count,
      total_cents:  r.total_cents,
      platform_cut_cents: platformCuts,
      partner_cut_cents:  partnerCuts,
    }
  })

  return NextResponse.json(meets)
}
