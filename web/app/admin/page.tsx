'use client'

import { useState, useEffect, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Types (mirroring database shapes returned by /api/admin/meets)
// ---------------------------------------------------------------------------

type HeatStatus = 'draft' | 'published' | 'hidden'

interface AthleteRow {
  id: string
  first_name: string
  last_name: string
  bib: string
  team: string | null
  finish_time: number | null
  place: number | null
  image_path: string | null
}

interface HeatRow {
  id: string
  event_num: string
  round: string
  heat_num: string
  event_name: string | null
  status?: HeatStatus
  effectiveStatus: HeatStatus
  created_at: string
  athletes: AthleteRow[]
}

interface MeetRow {
  id: string
  name: string
  date: string
  location: string | null
  created_at: string
  heats: HeatRow[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatTime(secs: number | null): string {
  if (secs == null) return '—'
  if (secs >= 60) {
    const m = Math.floor(secs / 60)
    const s = (secs % 60).toFixed(2).padStart(5, '0')
    return `${m}:${s}`
  }
  return secs.toFixed(2)
}

function statusBadge(status: HeatStatus) {
  const styles: Record<HeatStatus, string> = {
    draft:     'bg-yellow-100 text-yellow-800',
    published: 'bg-green-100 text-green-800',
    hidden:    'bg-gray-100 text-gray-500',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${styles[status]}`}>
      {status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminPage() {
  const [password, setPassword]     = useState('')
  const [authed, setAuthed]         = useState(false)
  const [authError, setAuthError]   = useState('')
  const [loading, setLoading]       = useState(false)
  const [meets, setMeets]           = useState<MeetRow[]>([])
  const [expanded, setExpanded]     = useState<Record<string, boolean>>({})
  const [busy, setBusy]             = useState<Record<string, boolean>>({})
  const [cleanupDays, setCleanupDays] = useState('14')
  const [cleanupResult, setCleanupResult] = useState<string | null>(null)
  const [toast, setToast]           = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchMeets = useCallback(async (pw: string) => {
    setLoading(true)
    const res = await fetch('/api/admin/meets', {
      headers: { Authorization: `Bearer ${pw}` },
    })
    setLoading(false)
    if (res.status === 401 || res.status === 503) {
      setAuthError('Wrong password.')
      return false
    }
    setMeets(await res.json())
    return true
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    const ok = await fetchMeets(password)
    if (ok) setAuthed(true)
  }

  async function setHeatStatus(heatId: string, status: HeatStatus) {
    setBusy((b) => ({ ...b, [heatId]: true }))
    const res = await fetch(`/api/admin/heats/${heatId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${password}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    })
    setBusy((b) => ({ ...b, [heatId]: false }))
    if (!res.ok) { showToast('Error updating heat status'); return }

    // Optimistic update
    setMeets((prev) =>
      prev.map((meet) => ({
        ...meet,
        heats: meet.heats.map((heat) =>
          heat.id === heatId
            ? { ...heat, status, effectiveStatus: status }
            : heat
        ),
      }))
    )
    showToast(`Heat marked as ${status}`)
  }

  async function deleteHeat(heatId: string, label: string) {
    if (!confirm(`Delete heat "${label}" and all its athlete images? This cannot be undone.`)) return
    setBusy((b) => ({ ...b, [heatId]: true }))
    const res = await fetch(`/api/admin/heats/${heatId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${password}` },
    })
    setBusy((b) => ({ ...b, [heatId]: false }))
    if (!res.ok) { showToast('Error deleting heat'); return }
    setMeets((prev) =>
      prev.map((meet) => ({ ...meet, heats: meet.heats.filter((h) => h.id !== heatId) }))
    )
    showToast('Heat deleted')
  }

  async function deleteMeet(meetId: string, name: string) {
    if (!confirm(`Delete entire meet "${name}" and ALL its athlete images? This cannot be undone.`)) return
    setBusy((b) => ({ ...b, [meetId]: true }))
    const res = await fetch(`/api/admin/meets/${meetId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${password}` },
    })
    setBusy((b) => ({ ...b, [meetId]: false }))
    if (!res.ok) { showToast('Error deleting meet'); return }
    setMeets((prev) => prev.filter((m) => m.id !== meetId))
    showToast(`Meet "${name}" deleted`)
  }

  async function handleCleanup() {
    const days = parseInt(cleanupDays, 10)
    if (isNaN(days) || days < 1) { showToast('Enter a valid number of days'); return }
    if (!confirm(`Delete all meets older than ${days} days? This cannot be undone.`)) return
    setCleanupResult(null)
    const res = await fetch('/api/admin/cleanup', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${password}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ daysOld: days }),
    })
    const data = await res.json()
    if (!res.ok) { showToast('Cleanup error'); return }
    if (data.deleted === 0) {
      setCleanupResult('No meets older than that threshold.')
    } else {
      setCleanupResult(`Deleted ${data.deleted} meet(s): ${data.meets.join(', ')}`)
    }
    await fetchMeets(password)
  }

  function toggleExpand(meetId: string) {
    setExpanded((e) => ({ ...e, [meetId]: !e[meetId] }))
  }

  // ---------------------------------------------------------------------------
  // Login screen
  // ---------------------------------------------------------------------------

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-600 mb-1">In Stride Timing</p>
            <h1 className="text-2xl font-extrabold text-gray-900">Admin Panel</h1>
          </div>
          <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Admin password"
                autoFocus
              />
            </div>
            {authError && <p className="text-sm text-red-600">{authError}</p>}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 rounded-xl transition-colors"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Admin dashboard
  // ---------------------------------------------------------------------------

  const totalHeats    = meets.reduce((s, m) => s + m.heats.length, 0)
  const draftCount    = meets.reduce((s, m) => s + m.heats.filter((h) => h.effectiveStatus === 'draft').length, 0)
  const publishCount  = meets.reduce((s, m) => s + m.heats.filter((h) => h.effectiveStatus === 'published').length, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg animate-in">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">In Stride Timing</p>
            <h1 className="text-lg font-extrabold text-gray-900 leading-tight">Admin Panel</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span><strong className="text-gray-800">{meets.length}</strong> meet{meets.length !== 1 ? 's' : ''}</span>
            <span><strong className="text-yellow-700">{draftCount}</strong> draft</span>
            <span><strong className="text-green-700">{publishCount}</strong> published</span>
            <button
              onClick={() => fetchMeets(password)}
              className="ml-2 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Cleanup card */}
        <section className="bg-white border border-gray-100 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Cleanup Old Meets</h2>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-gray-500">Delete meets older than</span>
            <input
              type="number"
              min={1}
              value={cleanupDays}
              onChange={(e) => setCleanupDays(e.target.value)}
              className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <span className="text-sm text-gray-500">days</span>
            <button
              onClick={handleCleanup}
              className="px-3 py-1.5 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg transition-colors"
            >
              Run Cleanup
            </button>
          </div>
          {cleanupResult && (
            <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{cleanupResult}</p>
          )}
        </section>

        {/* Meets list */}
        {loading && (
          <p className="text-sm text-gray-400 text-center py-12">Loading…</p>
        )}

        {!loading && meets.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-12">No meets yet.</p>
        )}

        {meets.map((meet) => (
          <section key={meet.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            {/* Meet header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <button
                onClick={() => toggleExpand(meet.id)}
                className="flex items-center gap-3 text-left flex-1 min-w-0"
              >
                <span className={`text-gray-400 text-xs transition-transform ${expanded[meet.id] ? 'rotate-90' : ''}`}>▶</span>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate">{meet.name}</p>
                  <p className="text-xs text-gray-400">
                    {formatDate(meet.date)}
                    {meet.location ? ` · ${meet.location}` : ''}
                    {' · '}{meet.heats.length} heat{meet.heats.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </button>
              <button
                disabled={busy[meet.id]}
                onClick={() => deleteMeet(meet.id, meet.name)}
                className="ml-4 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40 transition-colors"
              >
                {busy[meet.id] ? '…' : 'Delete Meet'}
              </button>
            </div>

            {/* Heats table */}
            {expanded[meet.id] && (
              <div className="divide-y divide-gray-50">
                {meet.heats.length === 0 && (
                  <p className="text-sm text-gray-400 px-5 py-4">No heats recorded.</p>
                )}
                {meet.heats.map((heat) => {
                  const heatLabel = heat.event_name
                    ? `${heat.event_name}  ·  Heat ${heat.heat_num}`
                    : `Event ${heat.event_num}  ·  Heat ${heat.heat_num}`
                  return (
                    <div key={heat.id} className="px-5 py-3.5 flex items-center gap-4 flex-wrap">
                      {/* Status badge */}
                      <div className="w-20 shrink-0">{statusBadge(heat.effectiveStatus)}</div>

                      {/* Heat info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{heatLabel}</p>
                        <p className="text-xs text-gray-400">
                          {heat.athletes.length} athlete{heat.athletes.length !== 1 ? 's' : ''}
                          {' · '}Round {heat.round}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {heat.effectiveStatus !== 'published' && (
                          <button
                            disabled={busy[heat.id]}
                            onClick={() => setHeatStatus(heat.id, 'published')}
                            className="px-2.5 py-1 text-xs font-semibold text-green-700 border border-green-200 rounded-lg hover:bg-green-50 disabled:opacity-40 transition-colors"
                          >
                            Publish
                          </button>
                        )}
                        {heat.effectiveStatus !== 'draft' && (
                          <button
                            disabled={busy[heat.id]}
                            onClick={() => setHeatStatus(heat.id, 'draft')}
                            className="px-2.5 py-1 text-xs font-semibold text-yellow-700 border border-yellow-200 rounded-lg hover:bg-yellow-50 disabled:opacity-40 transition-colors"
                          >
                            Unpublish
                          </button>
                        )}
                        {heat.effectiveStatus !== 'hidden' && (
                          <button
                            disabled={busy[heat.id]}
                            onClick={() => setHeatStatus(heat.id, 'hidden')}
                            className="px-2.5 py-1 text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
                          >
                            Hide
                          </button>
                        )}
                        <button
                          disabled={busy[heat.id]}
                          onClick={() => deleteHeat(heat.id, heatLabel)}
                          className="px-2.5 py-1 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40 transition-colors"
                        >
                          {busy[heat.id] ? '…' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        ))}
      </main>
    </div>
  )
}
