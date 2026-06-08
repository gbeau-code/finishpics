import { NextResponse } from 'next/server'
import { getRecentMeets } from '@/lib/database'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json(await getRecentMeets(10))
}
