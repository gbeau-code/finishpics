import Link from 'next/link'
import { CheckCircle2, Download, Image as ImageIcon, Sparkles, Clapperboard } from 'lucide-react'
import { getAthleteWithContext } from '@/lib/database'
import { getOrderBySession, confirmOrder } from '@/lib/orders'
import type { OrderWithItems } from '@/lib/orders'
import { getStripe } from '@/lib/stripe'
import { BUNDLES } from '@/lib/bundles'
import { formatTime, formatEventLabel } from '@/lib/format'
import SpeedLines from '@/app/components/ui/SpeedLines'
import Button from '@/app/components/ui/Button'
import ClearCart from './ClearCart'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Order Confirmed — FinishPics', robots: { index: false } }

interface Props {
  searchParams: Promise<{ session_id?: string }>
}

// ---------------------------------------------------------------------------
// Reconcile Stripe session → order (webhook may not have fired yet)
// ---------------------------------------------------------------------------
async function resolveOrder(sessionId: string): Promise<OrderWithItems | null> {
  const existing = await getOrderBySession(sessionId)
  if (existing) return existing

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId)
    if (session.payment_status === 'paid' && session.metadata?.fpKind === 'order') {
      await confirmOrder(
        session.id,
        typeof session.payment_intent === 'string' ? session.payment_intent : null,
        session.customer_details?.email ?? null,
      )
      return await getOrderBySession(sessionId)
    }
  } catch (err) {
    console.error('Order session retrieval failed:', err)
  }
  return null
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function OrderConfirmPage({ searchParams }: Props) {
  const { session_id } = await searchParams

  const order = session_id ? await resolveOrder(session_id) : null

  if (!order) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center fp-page-in">
        <p className="fp-display text-2xl text-fp-ink-strong mb-3">Payment processing…</p>
        <p className="text-fp-muted mb-6 leading-relaxed">
          We haven&apos;t received the payment confirmation yet. This usually takes a few
          seconds — refresh this page shortly. If you weren&apos;t charged, your cart is
          still saved.
        </p>
        <Button href="/cart" variant="outline">Back to cart</Button>
      </div>
    )
  }

  const token = encodeURIComponent(order.stripe_session_id)
  const orderDate = new Date(order.created_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  // Load athlete context for each item (display + capability-aware links)
  const items = await Promise.all(order.items.map(async (item) => {
    const athlete = await getAthleteWithContext(item.athlete_id)
    return { item, athlete }
  }))

  return (
    <div>
      <ClearCart />

      {/* ── Success hero ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-fp-hero text-white">
        <SpeedLines />
        <div className="relative max-w-[840px] mx-auto px-4 sm:px-6 lg:px-8 py-14 text-center">
          <CheckCircle2 className="w-12 h-12 text-fp-gold mx-auto mb-4" strokeWidth={2} />
          <p className="fp-eyebrow text-[11px] text-fp-gold mb-2">Order confirmed</p>
          <h1 className="fp-display text-4xl mb-3">You own your finish line.</h1>
          <p className="text-sm text-white/75">
            Order <span className="tnum font-extrabold text-white">{order.order_number}</span>
            {order.email && <> · {order.email}</>} · {orderDate} ·{' '}
            <span className="tnum">{dollars(order.amount_cents)}</span>
          </p>
          <p className="text-xs text-white/50 mt-3">
            Bookmark this page — your download links never expire.
          </p>
        </div>
        <div className="relative h-[3px] bg-fp-gold/90" />
      </section>

      {/* ── Download cards ─────────────────────────────────────────────── */}
      <div className="max-w-[840px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-5 fp-page-in">
        {items.map(({ item, athlete }) => {
          const b = BUNDLES[item.bundle]
          const socials = item.config?.socials ?? []
          if (!athlete) {
            return (
              <div key={item.id} className="rounded-fp-card border border-fp-border bg-white p-6 text-sm text-fp-muted">
                This photo is no longer available — contact support@finishpics.com with your
                order number and we&apos;ll make it right.
              </div>
            )
          }
          const displayName = athlete.first_name
            ? `${athlete.first_name} ${athlete.last_name}`
            : athlete.last_name
          const eventLabel = formatEventLabel(
            athlete.heat.event_num, athlete.heat.round, athlete.heat.heat_num, athlete.heat.event_name,
          )
          const hasFrames = (athlete.frame_count ?? 0) > 0

          const dl = 'flex items-center gap-2.5 rounded-[13px] border-2 border-fp-border bg-white px-4 py-3 text-sm font-extrabold text-fp-navy hover:border-fp-blue hover:text-fp-blue transition-colors duration-fp-fast'

          return (
            <div key={item.id} className="rounded-fp-card border border-fp-border bg-white shadow-fp-xs overflow-hidden">
              {/* Item header */}
              <div className="flex items-center justify-between gap-3 bg-fp-stage px-5 py-3.5">
                <div className="min-w-0">
                  <p className="font-extrabold text-fp-ink-strong truncate">
                    {displayName}
                    {athlete.finish_time != null && (
                      <span className="tnum text-fp-blue ml-2">{formatTime(athlete.finish_time)}</span>
                    )}
                  </p>
                  <p className="text-xs text-fp-muted truncate mt-0.5">
                    {athlete.heat.meet.name} · {eventLabel}
                  </p>
                </div>
                <span className="fp-display text-sm text-fp-navy shrink-0">{b.title} · {b.label}</span>
              </div>

              {/* Downloads */}
              <div className="p-5 grid gap-2.5 sm:grid-cols-2">
                {b.caps.rawPhoto && (
                  <a className={dl} href={`/api/download/${item.athlete_id}/raw?token=${token}`}>
                    <ImageIcon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                    Hi-res finish photo
                  </a>
                )}
                {b.caps.formatted && (
                  <a className={dl} href={`/api/download/${item.athlete_id}?token=${token}`}>
                    <Sparkles className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                    Formatted finish image
                  </a>
                )}
                {socials.map((s, i) => (
                  <a key={i} className={dl} href={`/api/social/${item.athlete_id}/${i}?token=${token}`}>
                    <Download className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                    {s.format === 'story' ? 'Story graphic · 9:16' : 'Post graphic · 1:1'}
                  </a>
                ))}
                {b.caps.frames && hasFrames && (
                  <a className={dl} href={`/api/frames/${item.athlete_id}/gif?token=${token}`}>
                    <Clapperboard className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                    Boomerang GIF
                  </a>
                )}
              </div>

              {b.caps.frames && hasFrames && (
                <p className="px-5 pb-4 -mt-1 text-xs text-fp-muted">
                  Your {athlete.frame_count} finish-line camera frames:{' '}
                  {Array.from({ length: athlete.frame_count! }, (_, i) => (
                    <a
                      key={i}
                      href={`/api/frames/${item.athlete_id}/${i}?token=${token}`}
                      className="tnum font-bold text-fp-blue hover:underline mr-1.5"
                    >
                      #{i + 1}
                    </a>
                  ))}
                </p>
              )}
            </div>
          )
        })}

        <p className="text-xs text-center text-fp-faint pt-2">
          Questions about your order? Email{' '}
          <a href="mailto:support@finishpics.com" className="text-fp-blue hover:underline">
            support@finishpics.com
          </a>{' '}
          with order <span className="tnum font-bold">{order.order_number}</span>.
        </p>
        <p className="text-center">
          <Link href="/meets" className="text-sm font-bold text-fp-blue hover:underline">
            Find another finish →
          </Link>
        </p>
      </div>
    </div>
  )
}
