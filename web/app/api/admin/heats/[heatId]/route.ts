import { NextRequest, NextResponse } from 'next/server'
import { updateHeatStatus, deleteHeat } from '@/lib/database'
import { requireAdmin } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { heatId: string } }
) {
  const authError = requireAdmin(request)
  if (authError) return authError

  const body = await request.json().catch(() => null)
  const status = body?.status
  if (status !== 'draft' && status !== 'published' && status !== 'hidden') {
    return NextResponse.json(
      { error: 'status must be "draft", "published", or "hidden"' },
      { status: 400 }
    )
  }

  const heat = await updateHeatStatus(params.heatId, status)
  if (!heat) {
    return NextResponse.json({ error: 'Heat not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, heat })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { heatId: string } }
) {
  const authError = requireAdmin(request)
  if (authError) return authError

  const deleted = await deleteHeat(params.heatId)
  if (!deleted) {
    return NextResponse.json({ error: 'Heat not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
