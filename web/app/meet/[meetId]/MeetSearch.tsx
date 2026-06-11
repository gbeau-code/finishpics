'use client'

import { useState, useCallback, useRef } from 'react'
import { AthleteCard, SearchResult } from '@/app/components/AthleteCard'

export default function MeetSearch({ meetId }: { meetId: string }) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); return }
    setLoading(true)
    setSearched(true)
    try {
      const res  = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}&meetId=${meetId}`)
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
    debounceTimer.current = setTimeout(() => doSearch(val), 300)
  }

  return (
    <>
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
            placeholder="Search by name or team..."
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
      {searched && (
        <div className="animate-card">
          {results.length > 0 ? (
            <>
              <p className="text-sm text-gray-500 mb-4">
                {results.length} result{results.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
              </p>
              <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                {results.map((athlete, i) => (
                  <AthleteCard key={athlete.id} athlete={athlete} index={i} showMeet={false} />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">&#128247;</div>
              <p className="text-xl font-semibold text-gray-700 mb-2">No results found</p>
              <p className="text-gray-500">Try searching by first name, last name, or team name.</p>
            </div>
          )}
        </div>
      )}
    </>
  )
}
