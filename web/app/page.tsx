'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { formatRound, formatTime, formatEventLabel } from '@/lib/format'

interface SearchResult {
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

interface Meet {
  id: string
  name: string
  date: string
}


function AthleteCard({ athlete, index }: { athlete: SearchResult; index: number }) {
  const eventLabel = formatEventLabel(
    athlete.heat.event_num,
    athlete.heat.round,
    athlete.heat.heat_num,
    athlete.heat.event_name
  )

  return (
    <div
      className="animate-card bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all group"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-lg font-bold text-gray-900 truncate">
              {athlete.first_name ? `${athlete.first_name} ${athlete.last_name}` : athlete.last_name}
            </h3>
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
          <p className="text-sm text-gray-600 mb-1 font-medium">{athlete.meet.name}</p>
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

export default function HomePage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [recentMeets, setRecentMeets] = useState<Meet[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load recent meets on mount
  useEffect(() => {
    fetch('/api/meets')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setRecentMeets(data)
      })
      .catch(() => {})
  }, [])

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setSearched(false)
      return
    }
    setLoading(true)
    setSearched(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
      const data = await res.json()
      setResults(Array.isArray(data) ? data : [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => doSearch(val), 300)
  }

  const formatMeetDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-3 tracking-tight">
          Your photo-finish moment.
        </h1>
        <p className="text-xl text-gray-500">Type your name — or your team name for relays — to find your photo-finish image.</p>
      </div>

      {/* Search bar */}
      <div className="max-w-2xl mx-auto mb-10">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={query}
            onChange={handleInput}
            placeholder="Search by name..."
            className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-blue-500 transition-colors bg-white shadow-sm placeholder-gray-400"
            autoFocus
          />
          {loading && (
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
              <svg className="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {searched ? (
        <div className="animate-card" style={{ animationDelay: '0ms' }}>
          {results.length > 0 ? (
            <>
              <p className="text-sm text-gray-500 mb-4">
                {results.length} result{results.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
              </p>
              <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                {results.map((athlete, i) => (
                  <AthleteCard key={athlete.id} athlete={athlete} index={i} />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">&#128247;</div>
              <p className="text-xl font-semibold text-gray-700 mb-2">No results found</p>
              <p className="text-gray-500">
                Try searching by first name, last name, or team name.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Recent meets */
        recentMeets.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Recent Meets
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recentMeets.map((meet) => (
                <div
                  key={meet.id}
                  className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3"
                >
                  <p className="font-semibold text-gray-800 text-sm">{meet.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{formatMeetDate(meet.date)}</p>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  )
}
