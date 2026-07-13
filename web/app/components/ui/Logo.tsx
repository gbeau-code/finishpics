import Link from 'next/link'
import { Flag } from 'lucide-react'

/**
 * FinishPics wordmark: skewed electric-blue flag tile + "Finish" (white) /
 * "Pics" (gold), 800 italic, optional tagline. Designed for navy backgrounds.
 */
export default function Logo({
  tagline = true,
  href = '/',
}: {
  tagline?: boolean
  href?: string | null
}) {
  const mark = (
    <span className="flex items-center gap-2.5">
      {/* Angled logo tile */}
      <span
        className="flex items-center justify-center w-8 h-8 rounded-fp-tile bg-fp-blue shadow-fp-blue-glow"
        style={{ transform: 'skewX(-6deg)' }}
      >
        <Flag className="w-4 h-4 text-white" style={{ transform: 'skewX(6deg)' }} strokeWidth={2.5} />
      </span>
      <span className="leading-none">
        <span className="fp-display text-xl">
          <span className="text-white">Finish</span>
          <span className="text-fp-gold">Pics</span>
        </span>
        {tagline && (
          <span className="block text-[8px] font-bold uppercase tracking-[0.22em] text-white/50 mt-1">
            Official Photo-Finish Images
          </span>
        )}
      </span>
    </span>
  )

  if (!href) return mark
  return (
    <Link href={href} className="group inline-flex" aria-label="FinishPics home">
      {mark}
    </Link>
  )
}
