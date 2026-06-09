import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAthleteWithContext, effectiveStatus } from '@/lib/database'
import { formatRound, formatTime, formatEventLabel } from '@/lib/format'
import FrameGallery from './FrameGallery'
import PurchaseSection from './PurchaseSection'
import { getPurchaseBySession, confirmPurchase } from '@/lib/purchases'
import { getStripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

interface Props {
  params:       Promise<{ athleteId: string }>
  searchParams: Promise<{ session_id?: string }>
}

// ---------------------------------------------------------------------------
// Reconcile Stripe session → purchase row
// Called when user returns from Stripe Checkout.
// Handles the race where the success page loads before the webhook fires.
// ---------------------------------------------------------------------------
async function resolveSessionPurchase(
  sessionId:  string,
  athleteId:  string,
) {
  // 1. Check DB first (webhook may have already confirmed it)
  const existing = await getPurchaseBySession(sessionId, athleteId)
  if (existing) return existing

  // 2. DB row not confirmed yet — verify directly with Stripe
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId)
    if (
      session.payment_status === 'paid' &&
      session.metadata?.athleteId === athleteId
    ) {
      await confirmPurchase(
        session.id,
        typeof session.payment_intent === 'string' ? session.payment_intent : null,
        session.customer_details?.email ?? null,
      )
      return await getPurchaseBySession(sessionId, athleteId)
    }
  } catch (err) {
    console.error('Stripe session retrieval failed:', err)
  }
  return null
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function PhotoPage({ params, searchParams }: Props) {
  const { athleteId }   = await params
  const { session_id }  = await searchParams

  const athlete = await getAthleteWithContext(athleteId)
  if (!athlete) notFound()
  if (effectiveStatus(athlete!.heat) !== 'published') notFound()

  const { heat } = athlete
  const meet     = heat.meet

  // Check for a post-payment session
  const sessionId = session_id ?? null
  const purchase  = sessionId
    ? await resolveSessionPurchase(sessionId, athleteId)
    : null

  const eventLabel = formatEventLabel(heat.event_num, heat.round, heat.heat_num, heat.event_name)
  const roundLabel = formatRound(heat.round)
  const hasFrames  = (athlete.frame_count ?? 0) > 0

  const meetDate = new Date(meet.date + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8 flex-wrap">
        <Link href="/" className="hover:text-blue-600 transition-colors">Home</Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-700 font-medium">{meet.name}</span>
        <span className="text-gray-300">/</span>
        <span>{eventLabel}</span>
      </nav>

      <div className="grid lg:grid-cols-5 gap-10">
        {/* Left: info + purchase/download */}
        <div className="lg:col-span-2 order-2 lg:order-1">
          <div className="bg-gray-50 rounded-2xl p-6 mb-6">
            <p className="text-sm font-medium text-gray-500 mb-0.5">{meet.name}</p>
            <p className="text-sm text-gray-400 mb-4">{meetDate}</p>

            <h1 className="text-2xl font-extrabold text-gray-900 mb-1">
              {athlete.first_name} {athlete.last_name}
            </h1>

            <div className="flex items-center gap-2 flex-wrap mb-4">
              {athlete.bib && athlete.bib !== '0' && (
                <span className="text-sm font-medium text-gray-600 bg-white border border-gray-200 px-2.5 py-0.5 rounded-lg">
                  Bib #{athlete.bib}
                </span>
              )}
              {athlete.team && <span className="text-sm text-gray-500">{athlete.team}</span>}
            </div>

            <div className="space-y-1.5 text-sm text-gray-600 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-400">Event</span>
                <span className="font-medium">{heat.event_name ?? `Event ${heat.event_num}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Round</span>
                <span className="font-medium">{roundLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Heat</span>
                <span className="font-medium">{heat.heat_num}</span>
              </div>
              {athlete.finish_time != null && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Finish Time</span>
                  <span className="font-mono font-semibold text-gray-800">{formatTime(athlete.finish_time)}</span>
                </div>
              )}
            </div>

            {/* Purchase / download section */}
            <PurchaseSection
              athleteId={athleteId}
              sessionId={sessionId}
              tier={purchase?.tier ?? null}
              hasFrames={hasFrames}
              lastName={athlete.last_name}
              purchaseEmail={purchase?.email ?? null}
            />
          </div>
        </div>

        {/* Right: watermarked preview + frame gallery */}
        <div className="lg:col-span-3 order-1 lg:order-2 space-y-5">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Photo Finish Image
            </p>
            <div className="bg-gray-100 rounded-2xl overflow-hidden shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/preview/${athleteId}`}
                className="w-full"
                alt={`Photo-finish image for ${athlete.first_name} ${athlete.last_name}`}
              />
            </div>
            <p className="mt-2 text-xs text-center text-gray-400">
              Watermark removed on purchase
            </p>
          </div>

          {hasFrames && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Finish-line camera &mdash; {athlete.frame_count} image{athlete.frame_count !== 1 ? 's' : ''}
              </p>
              <FrameGallery
                athleteId={athleteId}
                frameCount={athlete.frame_count!}
                lastName={athlete.last_name}
                token={purchase?.tier === 'full' ? (sessionId ?? null) : null}
              />
              <p className="mt-2 text-xs text-center text-gray-400">
                {purchase?.tier === 'full'
                  ? 'Click any frame to enlarge — then click the download button to save it'
                  : 'Purchase full package to download individual finish-line camera images'}
              </p>
            </div>
          )}
        </div>
      </div>
      {/* Disclaimer */}
      <p className="mt-10 text-xs text-center text-gray-400 max-w-2xl mx-auto leading-relaxed">
        Finish times are captured by photo-finish equipment and are provided for reference only.
        They do not constitute official results. Official results are determined by meet officials
        and directors — in the event of a disqualification, protest, or other ruling, officially
        posted results supersede any information shown here.
      </p>
    </div>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ athleteId: string }> }) {
  const { athleteId } = await params
  const athlete = await getAthleteWithContext(athleteId)
  if (!athlete || effectiveStatus(athlete.heat) !== 'published') {
    return { title: 'Athlete Not Found — FinishPics' }
  }
  return {
    title: `${athlete.first_name} ${athlete.last_name} — ${athlete.heat.meet.name} — FinishPics`,
  }
}
