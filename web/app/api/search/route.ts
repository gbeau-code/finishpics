import { NextRequest, NextResponse } from 'next/server'
import { searchAthletes } from '@/lib/database'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (!q) {
    return NextResponse.json([])
  }

  const results = await searchAthletes(q)

  return NextResponse.json(
    results.map((a) => ({
      id: a.id,
      first_name: a.first_name,
      last_name: a.last_name,
      bib: a.bib,
      team: a.team,
      place: a.place,
      finish_time: a.finish_time,
      heat: {
        id: a.heat.id,
        event_num: a.heat.event_num,
        round: a.heat.round,
        heat_num: a.heat.heat_num,
        event_name: a.heat.event_name,
      },
      meet: {
        id: a.heat.meet.id,
        name: a.heat.meet.name,
        date: a.heat.meet.date,
      },
    }))
  )
}
