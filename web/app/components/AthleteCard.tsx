import Link from 'next/link'
import { formatTime, formatEventLabel } from '@/lib/format'

export interface SearchResult {
  id: string
  first_name: string
  last_name: string
  bib: string
  team: string | null
  place: number | null
  finish_time: number | null
  heat: {
    id: string
    event_num: string
    round: string
    heat_num: string
    event_name: string | null
  }
  meet: {
    id: string
    name: string
    date: string
  }
}

export function AthleteCard({
  athlete,
  index,
  showMeet = true,
}: {
  athlete: SearchResult
  index: number
  showMeet?: boolean
}) {
  const eventLabel = formatEventLabel(
    athlete.heat.event_num,
    athlete.heat.round,
    athlete.heat.heat_num,
    athlete.heat.event_name,
  )
  const displayName = athlete.first_name
    ? `${athlete.first_name} ${athlete.last_name}`
    : athlete.last_name

  return (
    <div
      className="animate-card bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all group"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-lg font-bold text-gray-900 truncate">{displayName}</h3>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2 flex-wrap">
            {athlete.bib && athlete.bib !== '0' && (
              <span className="font-medium text-gray-700">Bib #{athlete.bib}</span>
            )}
            {athlete.team && (
              <>
                {athlete.bib && athlete.bib !== '0' && <span className="text-gray-300">&bull;</span>}
                <span>{athlete.team}</span>
              </>
            )}
          </div>
          {showMeet && (
            <p className="text-sm text-gray-600 mb-1 font-medium">{athlete.meet.name}</p>
          )}
          <p className="text-sm text-gray-500">{eventLabel}</p>
          {athlete.finish_time != null && (
            <p className="text-sm text-gray-700 mt-1.5 font-mono font-medium">
              {formatTime(athlete.finish_time)}
            </p>
          )}
        </div>

        <Link
          href={`/photo/${athlete.id}`}
          className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors mt-1"
        >
          View Photo
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  )
}
