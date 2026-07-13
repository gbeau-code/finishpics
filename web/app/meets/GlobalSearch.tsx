'use client'

/**
 * GlobalSearch — cross-meet athlete search on the meets index, restoring the
 * v1 home-page behavior for athletes who don't remember which meet to pick.
 * While a query is active it renders results in place of the meet grid
 * (the parent hides the grid via CSS peer state — simpler: results overlay).
 */

import { useState, useCallback, useRef } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { AthleteCard, SearchResult } from '@/app/components/AthleteCard'

export default function GlobalSearch() {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<SearchResult[]>([])
  const [loading, setLoading]   = useState(false)
  const [searched, setSearched] = useState(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); return }
    setLoading(true)
    setSearched(true)
    try {
      const res  = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
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

  return (
    <div className="max-w-2xl mx-auto mb-10">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="w-5 h-5 text-fp-faint" strokeWidth={2.25} />
        </div>
        <input
          type="text"
          value={query}
          onChange={handleInput}
          placeholder="Or search your name across all meets…"
          className="w-full pl-12 pr-4 py-3.5 border-2 border-fp-border rounded-fp-card focus:outline-none focus:border-fp-blue transition-colors duration-fp-fast bg-white shadow-fp-xs placeholder-fp-faint"
        />
        {loading && (
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
            <Loader2 className="fp-spin h-5 w-5 text-fp-blue" />
          </div>
        )}
      </div>

      {searched && (
        <div className="mt-5">
          {results.length > 0 ? (
            <>
              <p className="text-sm text-fp-muted mb-3">
                {results.length} result{results.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
              </p>
              <div className="space-y-3">
                {results.map((athlete, i) => (
                  <AthleteCard key={athlete.id} athlete={athlete} index={i} showMeet />
                ))}
              </div>
            </>
          ) : !loading && (
            <p className="text-sm text-center text-fp-muted py-6">
              No results — try your first name, last name, or bib number,
              or pick your meet below.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
