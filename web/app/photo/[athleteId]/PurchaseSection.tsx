'use client'

import { useState } from 'react'
import { TIERS } from '@/lib/stripe'
import type { Tier } from '@/lib/stripe'

interface Props {
  athleteId:     string
  sessionId:     string | null   // set if this is a post-payment success page
  tier:          Tier | null     // tier of the confirmed purchase, if any
  hasFrames:     boolean
  lastName:      string
  purchaseEmail: string | null   // email from the confirmed purchase, if available
}

export default function PurchaseSection({ athleteId, sessionId, tier, hasFrames, lastName, purchaseEmail }: Props) {
  const [loading,    setLoading   ] = useState<Tier | null>(null)
  const [error,      setError     ] = useState<string | null>(null)
  const [emailInput, setEmailInput] = useState(purchaseEmail ?? '')
  const [emailSent,  setEmailSent ] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailError,   setEmailError  ] = useState<string | null>(null)

  async function handleSendEmail() {
    if (!sessionId || !emailInput.trim()) return
    setEmailSending(true)
    setEmailError(null)
    setEmailSent(false)
    try {
      const res  = await fetch(`/api/email-links/${athleteId}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token: sessionId, email: emailInput.trim() }),
      })
      if (res.ok) {
        setEmailSent(true)
      } else {
        const data = await res.json()
        setEmailError(data.error ?? 'Could not send email. Please try again.')
      }
    } catch {
      setEmailError('Network error. Please try again.')
    } finally {
      setEmailSending(false)
    }
  }

  async function handlePurchase(selectedTier: Tier) {
    setLoading(selectedTier)
    setError(null)
    try {
      const res  = await fetch(`/api/checkout/${athleteId}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tier: selectedTier }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError('Could not start checkout. Please try again.')
        setLoading(null)
      }
    } catch {
      setError('Network error. Please try again.')
      setLoading(null)
    }
  }

  // ── Post-purchase: show download buttons ──────────────────────────────────
  if (tier && sessionId) {
    const token = encodeURIComponent(sessionId)

    return (
      <div className="space-y-3">
        {/* Thank-you banner */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">
          <p className="font-semibold mb-0.5">✓ Purchase complete — thank you!</p>
          <p className="text-green-700 text-xs">
            Bookmark this page or save your download links. Your receipt was sent by email.
          </p>
        </div>

        {/* Raw photo — available to all tiers */}
        <a
          href={`/api/download/${athleteId}/raw?token=${token}`}
          className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          ↓ Download Raw Photo
        </a>

        {/* Formatted photo — enhanced and full tiers */}
        {(tier === 'enhanced' || tier === 'full') && (
          <a
            href={`/api/download/${athleteId}?token=${token}`}
            className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            ↓ Download Formatted Photo
          </a>
        )}

        {/* Full-tier extras (frames + GIF) */}
        {tier === 'full' && (
          <>
            {hasFrames && (
              <a
                href={`/api/frames/${athleteId}/gif?token=${token}`}
                className="block w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
              >
                ↓ Download Boomerang GIF
              </a>
            )}

            {hasFrames && (
              <p className="text-xs text-center text-blue-700 font-medium">
                ↓ Scroll down — click any IdentiLynx frame to enlarge and download it individually
              </p>
            )}
          </>
        )}

        {/* Email links section */}
        <div className="border-t border-gray-100 pt-4 mt-2">
          <p className="text-xs font-semibold text-gray-500 mb-2">
            Email your download links
          </p>
          {emailSent ? (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              ✓ Sent! Check your inbox for your download links.
            </p>
          ) : (
            <div className="flex gap-2">
              <input
                type="email"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400"
              />
              <button
                onClick={handleSendEmail}
                disabled={emailSending || !emailInput.trim()}
                className="text-sm font-semibold bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-wait whitespace-nowrap"
              >
                {emailSending ? 'Sending…' : 'Send'}
              </button>
            </div>
          )}
          {emailError && (
            <p className="text-xs text-red-600 mt-1">{emailError}</p>
          )}
        </div>
      </div>
    )
  }

  // ── Pre-purchase: show options ────────────────────────────────────────────
  // When athlete has frames: basic ($5) + full ($10)
  // When no frames:          basic ($5) + enhanced ($7)
  const upgradeT: Tier        = hasFrames ? 'full' : 'enhanced'
  const upgradeTier           = TIERS[upgradeT]

  const upgradeDescription = hasFrames
    ? 'Raw + formatted photo-finish, all IdentiLynx frames + boomerang GIF'
    : 'Raw + formatted photo-finish with meet and race info included'

  return (
    <div className="space-y-3">
      {/* Basic tier */}
      <button
        onClick={() => handlePurchase('basic')}
        disabled={loading !== null}
        className="block w-full text-left bg-white border-2 border-gray-200 hover:border-blue-400 rounded-xl p-4 transition-colors disabled:opacity-60 disabled:cursor-wait group"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold text-gray-800 group-hover:text-blue-700">
            Raw Photo-Finish Image
          </span>
          <span className="text-lg font-bold text-blue-600">{TIERS.basic.label}</span>
        </div>
        <p className="text-xs text-gray-500">High-resolution JPEG — no watermark, no meet or race info</p>
        {loading === 'basic' && (
          <p className="text-xs text-blue-600 mt-1">Redirecting to checkout…</p>
        )}
      </button>

      {/* Enhanced or Full tier depending on hasFrames */}
      <button
        onClick={() => handlePurchase(upgradeT)}
        disabled={loading !== null}
        className="block w-full text-left bg-blue-50 border-2 border-blue-300 hover:border-blue-500 rounded-xl p-4 transition-colors disabled:opacity-60 disabled:cursor-wait group"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold text-blue-900 group-hover:text-blue-700">
            {upgradeTier.name}
            <span className="ml-2 text-xs font-normal bg-blue-600 text-white px-2 py-0.5 rounded-full">
              Best Value
            </span>
          </span>
          <span className="text-lg font-bold text-blue-600">{upgradeTier.label}</span>
        </div>
        <p className="text-xs text-blue-700">{upgradeDescription}</p>
        {loading === upgradeT && (
          <p className="text-xs text-blue-600 mt-1">Redirecting to checkout…</p>
        )}
      </button>

      {error && (
        <p className="text-xs text-red-600 text-center">{error}</p>
      )}

      <p className="text-xs text-center text-gray-400">
        Secure checkout powered by Stripe
      </p>
    </div>
  )
}
