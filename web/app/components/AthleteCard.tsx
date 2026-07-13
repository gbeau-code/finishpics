import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
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

/** Place badge — gold for the win, navy tint otherwise. */
function PlaceBadge({ place }: { place: number | null }) {
  const label = place != null ? String(place) : '–'
  const isWin = place === 1
  return (
    <span
      className={[
        'tnum flex items-center justify-center w-9 h-9 rounded-[9px] shrink-0',
        'fp-display text-base',
        isWin
          ? 'bg-fp-gold text-fp-ink-strong'
          : 'bg-fp-blue-tint text-fp-navy',
      ].join(' ')}
      aria-label={place != null ? `Place ${place}` : 'Place unknown'}
    >
      {label}
    </span>
  )
}

/**
 * Athlete result row (prototype "results list"): place badge, name + team,
 * event · heat, tabular finish time, chevron. Rows stagger in via .fp-stagger.
 */
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
    <Link
      href={`/photo/${athlete.id}`}
      className="fp-stagger group flex items-center gap-4 bg-white border border-fp-border rounded-fp-card px-4 py-3.5 shadow-fp-xs hover:border-fp-blue hover:shadow-fp-sm transition-all duration-fp-base"
      style={{ animationDelay: `${Math.min(index * 120, 920)}ms` }}
    >
      <PlaceBadge place={athlete.place} />

      <div className="flex-1 min-w-0">
        <p className="font-extrabold text-fp-ink-strong text-[15px] leading-tight truncate group-hover:text-fp-blue transition-colors duration-fp-fast">
          {displayName}
        </p>
        <p className="text-xs text-fp-muted truncate mt-0.5">
          {[
            athlete.team,
            athlete.bib && athlete.bib !== '0' ? `Bib ${athlete.bib}` : null,
          ].filter(Boolean).join(' · ')}
        </p>
        <p className="text-xs text-fp-faint truncate mt-0.5">
          {showMeet ? `${athlete.meet.name} · ${eventLabel}` : eventLabel}
        </p>
      </div>

      {athlete.finish_time != null && (
        <p className="tnum fp-display text-lg text-fp-navy shrink-0">
          {formatTime(athlete.finish_time)}
        </p>
      )}

      <ChevronRight className="w-4 h-4 text-fp-faint group-hover:text-fp-blue shrink-0 transition-colors duration-fp-fast" />
    </Link>
  )
}
