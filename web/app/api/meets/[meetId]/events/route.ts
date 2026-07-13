import { NextRequest, NextResponse } from 'next/server'
import { getPublishedEventsForMeet } from '@/lib/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Distinct published events/heats in a meet — powers the search filter chips. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ meetId: string }> },
) {
  const { meetId } = await params
  return NextResponse.json(await getPublishedEventsForMeet(meetId))
}
