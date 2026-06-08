import { NextRequest, NextResponse } from 'next/server'
import { getAllMeetsWithHeats, effectiveStatus } from '@/lib/database'
import { requireAdmin } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authError = requireAdmin(request)
  if (authError) return authError

  const meets = await getAllMeetsWithHeats()

  const result = meets.map((meet) => ({
    ...meet,
    heats: meet.heats.map((heat) => ({
      ...heat,
      effectiveStatus: effectiveStatus(heat),
    })),
  }))

  return NextResponse.json(result)
}
