'use client'

/**
 * Filter chip / segmented-control option. Selected state = electric-blue
 * border + text on blue-tint fill (prototype "selected-chip" spec).
 * Hit target kept ≥36px tall (rows are horizontally scrollable on mobile).
 */
export default function Chip({
  selected = false,
  onClick,
  children,
  className = '',
}: {
  selected?: boolean
  onClick?: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={[
        'inline-flex items-center gap-1.5 whitespace-nowrap px-3.5 py-1.5 min-h-[36px]',
        'text-sm font-bold rounded-[9px] border transition-colors duration-fp-fast',
        selected
          ? 'bg-fp-blue-tint border-fp-blue text-fp-blue'
          : 'bg-white border-fp-border text-fp-muted hover:border-fp-faint hover:text-fp-ink',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  )
}
