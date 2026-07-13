'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { AthleteCard, SearchResult } from '@/app/components/AthleteCard'
import Chip from '@/app/components/ui/Chip'
import { formatRound } from '@/lib/format'

interface MeetEvent {
  event_num:  string
  round:      string
  heat_num:   string
  event_name: string | null
  athlete_count: number
}

export default function MeetSearch({ meetId }: { meetId: string }) {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<SearchResult[]>([])
  const [loading, setLoading]   = useState(false)
  const [searched, setSearched] = useState(false)
  const [events, setEvents]     = useState<MeetEvent[]>([])
  const [selEvent, setSelEvent] = useState<string | null>(null)   // event_num
  const [selHeat, setSelHeat]   = useState<string | null>(null)   // `${round}|${heat_num}`
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load the event list for the filter chips
  useEffect(() => {
    fetch(`/api/meets/${meetId}/events`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setEvents(data) })
      .catch(() => {})
  }, [meetId])

  const doSearch = useCallback(async (q: string, event: string | null, heatKey: string | null) => {
    if (!q.trim() && !event) { setResults([]); setSearched(false); return }
    setLoading(true)
    setSearched(true)
    try {
      const params = new URLSearchParams({ meetId })
      if (q.trim()) params.set('q', q.trim())
      if (event)    params.set('event', event)
      if (heatKey) {
        const [round, heat] = heatKey.split('|')
        params.set('round', round)
        params.set('heat', heat)
      }
      const res  = await fetch(`/api/search?${params}`)
      const data = await res.json()
      setResults(Array.isArray(data) ? data : [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [meetId])

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => doSearch(val, selEvent, selHeat), 300)
  }

  const pickEvent = (eventNum: string | null) => {
    const next = eventNum === selEvent ? null : eventNum
    setSelEvent(next)
    setSelHeat(null)
    doSearch(query, next, null)
  }

  const pickHeat = (heatKey: string | null) => {
    const next = heatKey === selHeat ? null : heatKey
    setSelHeat(next)
    doSearch(query, selEvent, next)
  }

  // Distinct events for primary chips (an event may have several rounds/heats)
  const distinctEvents = events.reduce<MeetEvent[]>((acc, e) => {
    if (!acc.some(x => x.event_num === e.event_num)) acc.push(e)
    return acc
  }, [])
  const heatsOfSelected = selEvent
    ? events.filter(e => e.event_num === selEvent)
    : []

  return (
    <>
      {/* Search bar */}
      <div className="max-w-2xl mx-auto mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-fp-faint" strokeWidth={2.25} />
          </div>
          <input
            type="text"
            value={query}
            onChange={handleInput}
            placeholder="Search your name, team, or bib…"
            className="w-full pl-12 pr-4 py-4 text-lg border-2 border-fp-border rounded-fp-card focus:outline-none focus:border-fp-blue transition-colors duration-fp-fast bg-white shadow-fp-xs placeholder-fp-faint"
            autoFocus
          />
          {loading && (
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
              <Loader2 className="fp-spin h-5 w-5 text-fp-blue" />
            </div>
          )}
        </div>
      </div>

      {/* Event filter chips */}
      {distinctEvents.length > 0 && (
        <div className="max-w-2xl mx-auto mb-2 flex gap-2 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]">
          <Chip selected={selEvent === null} onClick={() => pickEvent(null)}>
            All events
          </Chip>
          {distinctEvents.map(e => (
            <Chip
              key={e.event_num}
              selected={selEvent === e.event_num}
              onClick={() => pickEvent(e.event_num)}
            >
              {e.event_name ?? `Event ${e.event_num}`}
            </Chip>
          ))}
        </div>
      )}

      {/* Round/heat chips for the selected event */}
      {heatsOfSelected.length > 1 && (
        <div className="max-w-2xl mx-auto mb-2 flex gap-2 overflow-x-auto pb-2">
          <Chip selected={selHeat === null} onClick={() => pickHeat(null)}>
            All heats
          </Chip>
          {heatsOfSelected.map(e => {
            const key = `${e.round}|${e.heat_num}`
            return (
              <Chip key={key} selected={selHeat === key} onClick={() => pickHeat(key)}>
                {formatRound(e.round)} · Heat {e.heat_num}
              </Chip>
            )
          })}
        </div>
      )}

      {/* Results */}
      {searched && (
        <div className="max-w-2xl mx-auto mt-6">
          {results.length > 0 ? (
            <>
              <p className="text-sm text-fp-muted mb-4">
                {results.length} result{results.length !== 1 ? 's' : ''}
                {query.trim() ? <> for &ldquo;{query}&rdquo;</> : null}
              </p>
              <div className="space-y-3">
                {results.map((athlete, i) => (
                  <AthleteCard key={athlete.id} athlete={athlete} index={i} showMeet={false} />
                ))}
              </div>
            </>
          ) : !loading && (
            <div className="text-center py-16">
              <p className="fp-display text-2xl text-fp-ink-strong mb-2">No results found</p>
              <p className="text-fp-muted">
                Try your first name, last name, team, or bib number.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  )
}
