import Banner from '@/app/components/ui/Banner'
import Downloads from '@/app/photo/[athleteId]/Downloads'
import Studio from '@/app/photo/[athleteId]/Studio'

/**
 * DEV-ONLY Social Studio playground — renders the Studio with sample data and
 * no database, for design iteration. Not linked from anywhere; remove or gate
 * before cutover.
 */

export const metadata = { title: 'Studio Playground — FinishPics (dev)', robots: { index: false } }

export default function DevStudioPage() {
  if (process.env.NODE_ENV === 'production' && process.env.FP_ENABLE_DEV_PAGES !== '1') {
    return <p className="p-10 text-center text-sm text-fp-muted">Not available.</p>
  }

  return (
    <div>
      <Banner
        eyebrow="Rhode Island State Championships"
        title="Colby Flynn"
        meta="Hendricken — Boys 3000 Meter Run · Final · Heat 1 · June 6, 2026"
      >
        <div className="text-right">
          <p className="fp-eyebrow text-[11px] text-fp-gold mb-1">1st place</p>
          <p className="tnum fp-display text-4xl text-white">8:45.06</p>
        </div>
      </Banner>
      <div className="max-w-[560px] mx-auto px-4 py-10">
        <Studio
          athleteId="dev-sample"
          previewSrc="/showcase-finish.jpg"
          info={{
            name: 'Colby Flynn',
            eventLabel: 'Boys 3000 Meter Run',
            timeLabel: '8:45.06',
            meetName: 'Rhode Island State Championships',
          }}
          team="Hendricken"
          display={{
            name: 'Colby Flynn',
            team: 'Hendricken',
            eventLabel: 'Boys 3000 Meter Run · Final · Heat 1',
            meetName: 'Rhode Island State Championships',
            timeLabel: '8:45.06',
          }}
          hasFrames
        />

        {/* Post-purchase Downloads rail (order token variant) */}
        <div className="mt-14">
          <p className="fp-eyebrow text-[11px] text-fp-blue mb-3">Post-purchase state (dev sample)</p>
          <div className="bg-fp-stage rounded-fp-card p-6">
            <Downloads
              athleteId="dev-sample"
              token="cs_test_dev_sample"
              caps={{ rawPhoto: true, formatted: true, frames: true }}
              socialFormats={['post', 'story']}
              hasFrames
              orderHref="/order/confirm?session_id=cs_test_dev_sample"
              purchaseEmail={null}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
