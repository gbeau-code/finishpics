import { NextRequest, NextResponse } from 'next/server'
import { deleteMeet } from '@/lib/database'
import { requireAdmin } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ meetId: string }> }
) {
  const authError = requireAdmin(request)
  if (authError) return authError

  const { meetId } = await params

  const deleted = await deleteMeet(meetId)
  if (!deleted) {
    return NextResponse.json({ error: 'Meet not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
