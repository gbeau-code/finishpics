import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { getRecentMeets } from '@/lib/database'
import Button from './components/ui/Button'
import SpeedLines from './components/ui/SpeedLines'
import Watermark from './components/ui/Watermark'

export const dynamic = 'force-dynamic'

const STEPS = [
  {
    num: '01',
    title: 'Find your meet',
    body: 'Search across every meet we shot, or jump in from a recent one.',
  },
  {
    num: '02',
    title: 'Search your name',
    body: 'Every finish-line frame of your race, with your official time attached.',
  },
  {
    num: '03',
    title: 'Style it & post',
    body: "Pick a format and overlay, copy the caption, and it's feed-ready.",
  },
]

function formatMeetDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default async function HomePage() {
  const recentMeets = await getRecentMeets(6).catch(() => [])

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-fp-hero text-white">
        <SpeedLines />
        <div className="relative max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="grid lg:grid-cols-[1fr_430px] gap-12 items-center">
            {/* Left: pitch */}
            <div>
              <p className="fp-eyebrow text-xs text-fp-gold mb-4">
                Official photo-finish images
              </p>
              <h1 className="fp-display text-5xl sm:text-6xl lg:text-[74px] leading-[0.94] mb-6">
                Own your finish <span className="text-fp-gold">line.</span>
              </h1>
              <p className="text-lg text-white/75 max-w-lg mb-8 leading-relaxed">
                The exact frame you crossed the line — captured by the official
                photo-finish camera, with your time attached. Find your race,
                style it, and make it yours.
              </p>
              <Button href="/meets" size="lg">
                Find my finish <ArrowRight className="w-5 h-5" strokeWidth={2.75} />
              </Button>
            </div>

            {/* Right: finish-photo showcase card */}
            <div className="hidden lg:block">
              <div className="rounded-fp-card overflow-hidden bg-fp-navy-deep shadow-fp-lg border border-white/10">
                <div className="relative">
                  <img
                    src="/showcase-finish.jpg"
                    alt="Photo-finish image of a race finish"
                    className="w-full h-[300px] object-cover"
                  />
                  <Watermark />
                  <div className="fp-scanline" />
                </div>
                <div className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="fp-display text-base text-white">Colby Flynn</p>
                    <p className="text-xs text-white/50 mt-0.5">Boys 3000m · Hendricken</p>
                  </div>
                  <p className="tnum fp-display text-2xl text-fp-gold">8:45.06</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="relative h-[3px] bg-fp-gold/90" />
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <p className="fp-eyebrow text-[11px] text-fp-blue mb-2">How it works</p>
        <h2 className="fp-display text-3xl text-fp-ink-strong mb-10">
          Three steps to feed-ready
        </h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {STEPS.map((s) => (
            <div key={s.num} className="rounded-fp-card border border-fp-border bg-white p-6 shadow-fp-xs">
              <p className="fp-display text-4xl text-fp-gold mb-3">{s.num}</p>
              <h3 className="fp-display text-lg text-fp-ink-strong mb-2">{s.title}</h3>
              <p className="text-sm text-fp-muted leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Recent meets ─────────────────────────────────────────────────── */}
      {recentMeets.length > 0 && (
        <section className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="fp-eyebrow text-[11px] text-fp-blue mb-2">Fresh from the line</p>
              <h2 className="fp-display text-3xl text-fp-ink-strong">Recent meets</h2>
            </div>
            <Link
              href="/meets"
              className="text-sm font-bold text-fp-blue hover:underline whitespace-nowrap"
            >
              All meets →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentMeets.map((meet) => (
              <Link
                key={meet.id}
                href={`/meet/${meet.id}`}
                className="group relative overflow-hidden rounded-fp-card bg-fp-hero text-white p-5 shadow-fp-sm hover:shadow-fp-md transition-shadow duration-fp-base"
              >
                <SpeedLines />
                <div className="relative">
                  <p className="fp-display text-lg leading-tight group-hover:text-fp-gold transition-colors duration-fp-fast">
                    {meet.name}
                  </p>
                  <p className="text-xs text-white/60 mt-2">
                    {formatMeetDate(meet.date)}
                    {meet.location ? ` · ${meet.location}` : ''}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
