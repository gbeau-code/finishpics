/**
 * Format a round code into a human-readable string.
 */
export function formatRound(round: string): string {
  const map: Record<string, string> = {
    F: 'Final',
    S: 'Semifinal',
    P: 'Prelim',
    Q: 'Quarterfinal',
    H: 'Heat',
  }
  return map[round.toUpperCase()] ?? round
}

/**
 * Ceiling a time value to the nearest hundredth of a second.
 *
 * Track & field rule: if the sub-hundredth portion is anything other than
 * exactly zero, the displayed time is rounded UP to the next hundredth.
 * e.g. 4:34.731 → 4:34.74,  4:34.730 → 4:34.73
 *
 * Uses an epsilon guard so that floating-point representation noise in values
 * that are already exact hundredths (e.g. 274.73 ≈ 27473.0000000004 × 10⁻²)
 * does not incorrectly trigger the ceiling.
 */
export function ceilToHundredths(seconds: number): number {
  const scaled     = seconds * 100
  const nearestInt = Math.round(scaled)
  // If within floating-point epsilon of an exact hundredth, treat as exact
  if (Math.abs(scaled - nearestInt) < 1e-9) return nearestInt / 100
  return Math.ceil(scaled) / 100
}

/**
 * Format a finish time (in seconds) as M:SS.hh or SS.hh,
 * applying the track & field ceiling rule to hundredths.
 */
export function formatTime(seconds: number | null | undefined): string {
  if (seconds == null) return '—'
  const t = ceilToHundredths(seconds)
  if (t >= 60) {
    const mins = Math.floor(t / 60)
    const secs = t % 60
    return `${mins}:${secs.toFixed(2).padStart(5, '0')}`
  }
  return t.toFixed(2)
}

/**
 * Format a place integer as an ordinal string: 1 → "1st", 2 → "2nd", etc.
 */
export function formatPlace(place: number | null | undefined): string {
  if (place == null) return '—'
  const suffixes = ['th', 'st', 'nd', 'rd']
  const v = place % 100
  const suffix = suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]
  return `${place}${suffix}`
}

/**
 * Format a cents amount as dollars: 1500 → "$15", 1250 → "$12.50".
 * One formatter for cart, order page, admin, and emails — keep in sync.
 */
export function formatCents(cents: number): string {
  const s = (cents / 100).toFixed(2)
  return `$${s.endsWith('.00') ? s.slice(0, -3) : s}`
}

/**
 * Format a YYYY-MM-DD meet date for display.
 * 'long' → "June 12, 2026" · 'short' → "Jun 12, 2026"
 * (T00:00:00 pins the date to local time so it doesn't shift a day.)
 */
export function formatMeetDate(dateStr: string, style: 'long' | 'short' = 'long'): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: style, day: 'numeric', year: 'numeric',
  })
}

/**
 * Format event/round/heat into a readable event description.
 * e.g. "Event 1 · Final · Heat 2"
 */
export function formatEventLabel(
  eventNum: string,
  round: string,
  heatNum: string,
  eventName?: string | null
): string {
  const roundLabel = formatRound(round)
  if (eventName) {
    return `${eventName} · ${roundLabel} · Heat ${heatNum}`
  }
  return `Event ${eventNum} · ${roundLabel} · Heat ${heatNum}`
}
