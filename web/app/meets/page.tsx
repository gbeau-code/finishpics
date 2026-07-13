import Link from 'next/link'
import { MapPin, Calendar } from 'lucide-react'
import { getRecentMeets } from '@/lib/database'
import { formatMeetDate } from '@/lib/format'
import Banner from '../components/ui/Banner'
import SpeedLines from '../components/ui/SpeedLines'
import GlobalSearch from './GlobalSearch'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'All Meets — FinishPics',
}

export default async function MeetsPage() {
  const meets = await getRecentMeets(100).catch(() => [])

  return (
    <div>
      <Banner
        eyebrow="Find my finish"
        title="Pick your meet"
        meta="Every meet we shot, newest first. Your race is inside."
      />

      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <GlobalSearch />
        {meets.length === 0 ? (
          <div className="text-center py-20">
            <p className="fp-display text-2xl text-fp-ink-strong mb-2">No meets yet</p>
            <p className="text-fp-muted">Fresh meets land here right after we shoot them.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {meets.map((meet, i) => (
              <Link
                key={meet.id}
                href={`/meet/${meet.id}`}
                className="fp-stagger group rounded-fp-card overflow-hidden border border-fp-border bg-white shadow-fp-xs hover:shadow-fp-md transition-shadow duration-fp-base"
                style={{ animationDelay: `${Math.min(i * 60, 600)}ms` }}
              >
                {/* Navy visual band (meet thumbnails are a P5 nicety) */}
                <div className="relative h-24 bg-fp-hero overflow-hidden">
                  <SpeedLines />
                  <div className="absolute bottom-3 left-4 fp-eyebrow text-[10px] text-fp-gold">
                    Photo-finish images
                  </div>
                </div>
                <div className="p-5">
                  <h2 className="fp-display text-xl text-fp-ink-strong leading-tight group-hover:text-fp-blue transition-colors duration-fp-fast">
                    {meet.name}
                  </h2>
                  <div className="mt-3 space-y-1 text-sm text-fp-muted">
                    <p className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-fp-faint" />
                      {formatMeetDate(meet.date)}
                    </p>
                    {meet.location && (
                      <p className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-fp-faint" />
                        {meet.location}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
