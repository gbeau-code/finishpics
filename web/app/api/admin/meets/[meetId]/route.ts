import { NextRequest, NextResponse } from 'next/server'
import { deleteMeet } from '@/lib/database'
import { requireAdmin } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { meetId: string } }
) {
  const authError = requireAdmin(request)
  if (authError) return authError

  const deleted = await deleteMeet(params.meetId)
  if (!deleted) {
    return NextResponse.json({ error: 'Meet not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
