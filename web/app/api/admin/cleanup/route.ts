import { NextRequest, NextResponse } from 'next/server'
import { cleanupOldMeets } from '@/lib/database'
import { requireAdmin } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const authError = requireAdmin(request)
  if (authError) return authError

  const body = await request.json().catch(() => ({}))
  const daysOld = Number(body?.daysOld ?? 14)

  if (isNaN(daysOld) || daysOld < 1) {
    return NextResponse.json({ error: 'daysOld must be a positive integer' }, { status: 400 })
  }

  const result = await cleanupOldMeets(daysOld)
  return NextResponse.json({ ok: true, ...result })
}
