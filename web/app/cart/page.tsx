'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, Pencil, ShoppingBag, Trash2 } from 'lucide-react'
import Banner from '@/app/components/ui/Banner'
import Button from '@/app/components/ui/Button'
import { useCart } from '@/app/components/CartContext'
import { BUNDLES } from '@/lib/bundles'
import { cartTotalCents } from '@/lib/cart'

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`
}

export default function CartPage() {
  const { lines, removeLine, count } = useCart()
  const [placing, setPlacing] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const total = cartTotalCents(lines)

  async function checkout() {
    setPlacing(true)
    setError(null)
    try {
      const res = await fetch('/api/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: lines.map(l => ({ athleteId: l.athleteId, bundle: l.bundle, config: l.config })),
        }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error ?? 'Could not start checkout. Please try again.')
        setPlacing(false)
      }
    } catch {
      setError('Network error. Please try again.')
      setPlacing(false)
    }
  }

  return (
    <div>
      <Banner
        eyebrow="Almost yours"
        title="Your cart"
        meta={count > 0 ? `${count} finish${count === 1 ? '' : 'es'} ready for checkout` : undefined}
      />

      <div className="max-w-[840px] mx-auto px-4 sm:px-6 lg:px-8 py-10 fp-page-in">
        {lines.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag className="w-10 h-10 text-fp-faint mx-auto mb-4" />
            <p className="fp-display text-2xl text-fp-ink-strong mb-2">Your cart is empty</p>
            <p className="text-fp-muted mb-6">Find your race and style your finish.</p>
            <Button href="/meets">Find my finish</Button>
          </div>
        ) : (
          <>
            {/* Lines */}
            <div className="space-y-3 mb-8">
              {lines.map(line => {
                const b = BUNDLES[line.bundle]
                const socialsNote = ({
                  raw:         'Hi-res photo, no overlay',
                  photosocial: 'Photo + formatted image',
                  works:       'Photo + formatted + post & story',
                  social:      'Post & story graphics, no photo file',
                } as const)[line.bundle]
                return (
                  <div
                    key={line.lineId}
                    className="flex items-center gap-4 bg-white border border-fp-border rounded-fp-card px-4 py-3.5 shadow-fp-xs"
                  >
                    {/* Thumb */}
                    <div className="w-24 h-16 rounded-[9px] overflow-hidden bg-fp-stage shrink-0 hidden sm:block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/preview/${line.athleteId}`}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold text-fp-ink-strong text-[15px] leading-tight truncate">
                        {line.display.name}
                        {line.display.timeLabel && (
                          <span className="tnum text-fp-blue ml-2">{line.display.timeLabel}</span>
                        )}
                      </p>
                      <p className="text-xs text-fp-muted truncate mt-0.5">
                        {line.display.meetName} · {line.display.eventLabel}
                      </p>
                      <p className="text-xs text-fp-faint truncate mt-0.5">
                        <span className="font-bold text-fp-navy">{b.title}</span> — {socialsNote}
                      </p>
                    </div>

                    <p className="tnum fp-display text-lg text-fp-navy shrink-0">{b.label}</p>

                    <div className="flex flex-col gap-1.5 shrink-0">
                      <Link
                        href={`/photo/${line.athleteId}`}
                        aria-label={`Edit ${line.display.name}`}
                        className="p-1.5 text-fp-faint hover:text-fp-blue transition-colors duration-fp-fast"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeLine(line.lineId)}
                        aria-label={`Remove ${line.display.name}`}
                        className="p-1.5 text-fp-faint hover:text-red-500 transition-colors duration-fp-fast"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Summary */}
            <div className="rounded-fp-card border border-fp-border bg-fp-stage p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="fp-display text-lg text-fp-ink-strong">Total</p>
                <p className="tnum fp-display text-3xl text-fp-navy">{dollars(total)}</p>
              </div>
              <Button onClick={checkout} disabled={placing} className="w-full" size="lg">
                {placing
                  ? <><Loader2 className="fp-spin w-5 h-5" /> Starting checkout…</>
                  : <>Checkout · {dollars(total)}</>}
              </Button>
              {error && <p className="text-sm text-red-600 text-center mt-3">{error}</p>}
              <p className="text-xs text-center text-fp-faint mt-3">
                Secure checkout powered by Stripe — your email at checkout receives the download links
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
