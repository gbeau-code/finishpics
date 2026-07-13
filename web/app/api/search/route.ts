import { NextRequest, NextResponse } from 'next/server'
import { searchAthletes, listAthletesByEvent } from '@/lib/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const sp     = request.nextUrl.searchParams
  const q      = sp.get('q')?.trim() ?? ''
  const meetId = sp.get('meetId')?.trim() || null
  const event  = sp.get('event')?.trim() || null
  const round  = sp.get('round')?.trim() || null
  const heat   = sp.get('heat')?.trim() || null

  // Browse-by-event: no query needed when an event filter is set within a meet
  let results
  if (q) {
    // Filters are pushed into SQL (pre-LIMIT) so matches never vanish
    // behind the row cap
    results = await searchAthletes(q, meetId, 20, { event, round, heat })
  } else if (meetId && event) {
    results = await listAthletesByEvent(meetId, event, round, heat)
  } else {
    return NextResponse.json([])
  }

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
