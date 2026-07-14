import SpeedLines from './SpeedLines'

/**
 * Navy page banner with speed lines — used at the top of meets index, meet
 * search, athlete photo, cart, and checkout screens.
 */
export default function Banner({
  eyebrow,
  title,
  meta,
  children,
  className = '',
  checker = false,
}: {
  /** Small gold label above the title (e.g. "Meet"). */
  eyebrow?: string
  title: React.ReactNode
  /** Secondary line under the title (date · venue, event · heat, …). */
  meta?: React.ReactNode
  /** Extra content on the right side (badges, actions). */
  children?: React.ReactNode
  className?: string
  /** Use a checkered finish-line stripe as the baseline instead of the gold bar. */
  checker?: boolean
}) {
  return (
    <section className={`relative overflow-hidden bg-fp-hero text-white ${className}`}>
      <SpeedLines />
      <div className="relative max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && (
              <p className="fp-eyebrow text-[11px] text-fp-gold mb-2">{eyebrow}</p>
            )}
            <h1 className="fp-display text-3xl sm:text-4xl leading-[0.98]">{title}</h1>
            {meta && (
              <p className="mt-2 text-sm text-white/75">{meta}</p>
            )}
          </div>
          {children && <div className="flex items-center gap-3 shrink-0">{children}</div>}
        </div>
      </div>
      {checker ? (
        <div
          className="relative h-3.5"
          style={{
            background: 'repeating-conic-gradient(#fff 0% 25%, #0A1B3D 0% 50%)',
            backgroundSize: '14px 14px',
          }}
        />
      ) : (
        <div className="relative h-[3px] bg-fp-gold/90" />
      )}
    </section>
  )
}
