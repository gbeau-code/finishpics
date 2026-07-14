import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAthleteWithContext, effectiveStatus } from '@/lib/database'
import { formatRound, formatTime, formatEventLabel, formatMeetDate, formatPlace } from '@/lib/format'
import Banner from '@/app/components/ui/Banner'
import FrameGallery from './FrameGallery'
import PhotoStudio from './PhotoStudio'
import { getPurchaseBySession, confirmPurchase } from '@/lib/purchases'
import { resolveAccess, reconcileOrderSession } from '@/lib/orders'
import { getStripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

interface Props {
  params:       Promise<{ athleteId: string }>
  searchParams: Promise<{ session_id?: string }>
}

// ---------------------------------------------------------------------------
// Reconcile Stripe session → purchase row (legacy v1 single-athlete purchases;
// kept forever so pre-v2 download links never break)
// ---------------------------------------------------------------------------
async function resolveSessionPurchase(sessionId: string, athleteId: string) {
  const existing = await getPurchaseBySession(sessionId, athleteId)
  if (existing) return existing

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
  const { athleteId }  = await params
  const { session_id } = await searchParams

  const athlete = await getAthleteWithContext(athleteId)
  if (!athlete) notFound()
  if (effectiveStatus(athlete!.heat) !== 'published') notFound()

  const { heat } = athlete
  const meet     = heat.meet

  const sessionId = session_id ?? null
  // Legacy reconciliation first (confirms a pending v1 purchase via Stripe if
  // the webhook hasn't fired), then unified resolution across BOTH systems —
  // a v2 order token unlocks this page too.
  const purchase = sessionId
    ? await resolveSessionPurchase(sessionId, athleteId)
    : null
  let access = sessionId
    ? await resolveAccess(sessionId, athleteId)
    : null
  if (sessionId && !access?.source) {
    // Possibly a v2 order whose webhook hasn't fired yet — reconcile with
    // Stripe directly (same path /order/confirm uses), then re-resolve
    const order = await reconcileOrderSession(sessionId)
    if (order) access = await resolveAccess(sessionId, athleteId)
  }

  const displayName = athlete.first_name
    ? `${athlete.first_name} ${athlete.last_name}`
    : athlete.last_name
  const eventLabel = formatEventLabel(heat.event_num, heat.round, heat.heat_num, heat.event_name)
  const eventName  = heat.event_name ?? `Event ${heat.event_num}`
  const roundLabel = formatRound(heat.round)
  const hasFrames  = (athlete.frame_count ?? 0) > 0
  const timeLabel  = athlete.finish_time != null ? formatTime(athlete.finish_time) : null

  const meetDate = formatMeetDate(meet.date)

  const socialFormats = (access?.item?.config?.socials ?? []).map(s => s.format)

  return (
    <div>
      {/* ── Athlete banner ─────────────────────────────────────────────── */}
      <Banner
        eyebrow={meet.name}
        title={displayName}
        checker
        meta={
          <>
            {[athlete.team, athlete.bib && athlete.bib !== '0' ? `Bib ${athlete.bib}` : null]
              .filter(Boolean).join(' · ')}
            {(athlete.team || (athlete.bib && athlete.bib !== '0')) && ' — '}
            {eventName} · {roundLabel} · Heat {heat.heat_num} · {meetDate}
          </>
        }
      >
        <div className="text-right">
          {athlete.place != null && (
            <p className="fp-eyebrow text-[11px] text-fp-gold mb-1">
              {formatPlace(athlete.place)} place
            </p>
          )}
          {timeLabel && (
            <p className="tnum fp-display text-4xl text-white">{timeLabel}</p>
          )}
        </div>
      </Banner>

      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 py-8 fp-page-in">
        {/* Breadcrumb back */}
        <nav className="text-sm text-fp-muted mb-6">
          <Link href={`/meet/${meet.id}`} className="font-bold text-fp-blue hover:underline">
            ← {meet.name}
          </Link>
          <span className="text-fp-faint"> / {eventLabel}</span>
        </nav>

        <PhotoStudio
          athleteId={athleteId}
          rawSrc={`/api/preview/${athleteId}`}
          cardSrc={`/api/preview/${athleteId}/card`}
          info={{
            name:       displayName,
            team:       athlete.team,
            bib:        athlete.bib,
            eventName,
            eventLabel,
            roundLabel,
            heatNum:    heat.heat_num,
            timeLabel,
            meetName:   meet.name,
          }}
          display={{ name: displayName, team: athlete.team, eventLabel, meetName: meet.name, timeLabel }}
          hasFrames={hasFrames}
          access={access?.source ? { caps: access.caps, socialFormats, source: access.source } : null}
          token={sessionId}
          orderHref={access?.source === 'order' && sessionId
            ? `/order/confirm?session_id=${encodeURIComponent(sessionId)}`
            : null}
          purchaseEmail={purchase?.email ?? null}
        />

        {/* Finish-line camera frames */}
        {hasFrames && (
          <div className="mt-10">
            <p className="fp-eyebrow text-[11px] text-fp-navy not-italic mb-2">
              Finish-line camera — {athlete.frame_count} image{athlete.frame_count !== 1 ? 's' : ''}
            </p>
            <FrameGallery
              athleteId={athleteId}
              frameCount={athlete.frame_count!}
              lastName={athlete.last_name}
              token={access?.caps.frames ? (sessionId ?? null) : null}
            />
            <p className="mt-2 text-xs text-center text-fp-faint">
              {access?.caps.frames
                ? 'Click any frame to enlarge — then click the download button to save it'
                : 'Included with the Full bundle'}
            </p>
          </div>
        )}

        {/* Disclaimer */}
        <p className="mt-12 text-xs text-center text-fp-faint max-w-2xl mx-auto leading-relaxed">
          Finish times are captured by photo-finish equipment and are provided for reference only.
          They do not constitute official results. Official results are determined by meet officials
          and directors — in the event of a disqualification, protest, or other ruling, officially
          posted results supersede any information shown here.
        </p>
      </div>
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
    title: `${athlete.first_name ? `${athlete.first_name} ${athlete.last_name}` : athlete.last_name} — ${athlete.heat.meet.name} — FinishPics`,
  }
}
