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

  // Sales = legacy per-athlete purchases UNION v2 order items (both paid).
  // Buckets count by PRODUCT (tier/bundle), not price — the $5 'social'
  // bundle must not inflate the raw-photo count.
  const rows = await sql`
    WITH sales AS (
      SELECT p.athlete_id, p.amount_cents, p.tier AS product
      FROM purchases p
      WHERE p.status = 'paid'
      UNION ALL
      SELECT oi.athlete_id, oi.amount_cents, oi.bundle AS product
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status = 'paid'
    )
    SELECT
      m.id,
      m.name,
      m.date,
      m.company_name,
      COUNT(s.athlete_id)::int                                                    AS sale_count,
      COALESCE(SUM(s.amount_cents), 0)::int                                       AS total_cents,
      COUNT(s.athlete_id) FILTER (WHERE s.product IN ('basic', 'raw'))::int        AS basic_count,
      COUNT(s.athlete_id) FILTER (WHERE s.product IN ('enhanced', 'photosocial'))::int AS enhanced_count,
      COUNT(s.athlete_id) FILTER (WHERE s.product IN ('full', 'works'))::int       AS full_count,
      COUNT(s.athlete_id) FILTER (WHERE s.product = 'social')::int                 AS social_count
    FROM meets m
    LEFT JOIN heats    h ON h.meet_id    = m.id
    LEFT JOIN athletes a ON a.heat_id    = h.id
    LEFT JOIN sales    s ON s.athlete_id = a.id
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
      basic_count:    r.basic_count,
      enhanced_count: r.enhanced_count,
      full_count:     r.full_count,
      social_count:   r.social_count,
    }
  })

  return NextResponse.json(meets)
}
