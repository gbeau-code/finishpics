import Banner from '@/app/components/ui/Banner'
import PhotoStudio from '@/app/photo/[athleteId]/PhotoStudio'

/**
 * DEV-ONLY photo-studio playground — renders PhotoStudio with sample data and
 * no database, for design iteration. Not linked from anywhere; gated out of
 * production unless FP_ENABLE_DEV_PAGES=1. Uses the bundled showcase image for
 * both the raw and card previews (no server render needed).
 */

export const metadata = { title: 'Studio Playground — FinishPics (dev)', robots: { index: false } }

const INFO = {
  name: 'Colby Flynn',
  team: 'Hendricken',
  bib: '1',
  eventName: 'Boys 3000 Meter Run',
  eventLabel: 'Boys 3000 Meter Run · Final · Heat 1',
  roundLabel: 'Final',
  heatNum: '1',
  timeLabel: '8:45.06',
  meetName: 'Rhode Island State Championships',
}

export default function DevStudioPage() {
  if (process.env.NODE_ENV === 'production' && process.env.FP_ENABLE_DEV_PAGES !== '1') {
    return <p className="p-10 text-center text-sm text-fp-muted">Not available.</p>
  }

  return (
    <div>
      <Banner eyebrow="Rhode Island State Championships" title="Colby Flynn" checker
        meta="Hendricken — Boys 3000 Meter Run · Final · Heat 1 · June 6, 2026">
        <div className="text-right">
          <p className="fp-eyebrow text-[11px] text-fp-gold mb-1">1st place</p>
          <p className="tnum fp-display text-4xl text-white">8:45.06</p>
        </div>
      </Banner>
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PhotoStudio
          athleteId="dev-sample"
          rawSrc="/showcase-finish.jpg"
          cardSrc="/showcase-finish.jpg"
          info={INFO}
          display={{ name: INFO.name, team: INFO.team, eventLabel: INFO.eventLabel, meetName: INFO.meetName, timeLabel: INFO.timeLabel }}
          hasFrames
          access={null}
          token={null}
          orderHref={null}
          purchaseEmail={null}
        />
      </div>
    </div>
  )
}
