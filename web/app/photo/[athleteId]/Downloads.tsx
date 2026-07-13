'use client'

/**
 * Downloads — post-purchase rail on the photo page. Capability-driven, so it
 * serves BOTH legacy per-athlete purchases and v2 combined orders: the caller
 * resolves the token via resolveAccess() and passes what it unlocks.
 */

import { useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2, Clapperboard, Download, Image as ImageIcon, Sparkles,
} from 'lucide-react'
import type { GraphicFormat } from '@/lib/graphic-spec'

interface Props {
  athleteId:     string
  token:         string
  caps:          { rawPhoto: boolean; formatted: boolean; frames: boolean }
  /** Formats of purchased social graphics, in order (index = download index). */
  socialFormats: GraphicFormat[]
  hasFrames:     boolean
  /** Link to the full order page when the token is a v2 combined order. */
  orderHref:     string | null
  purchaseEmail: string | null
}

export default function Downloads({
  athleteId, token, caps, socialFormats, hasFrames, orderHref, purchaseEmail,
}: Props) {
  const enc = encodeURIComponent(token)
  const [emailInput,   setEmailInput]   = useState(purchaseEmail ?? '')
  const [emailSent,    setEmailSent]    = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailError,   setEmailError]   = useState<string | null>(null)

  async function handleSendEmail() {
    if (!emailInput.trim()) return
    setEmailSending(true)
    setEmailError(null)
    setEmailSent(false)
    try {
      const res = await fetch(`/api/email-links/${athleteId}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, email: emailInput.trim() }),
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

  const dl = 'flex items-center gap-2.5 rounded-[13px] border-2 border-fp-border bg-white px-4 py-3 text-sm font-extrabold text-fp-navy hover:border-fp-blue hover:text-fp-blue transition-colors duration-fp-fast'
  const icon = { width: 18, height: 18 }

  return (
    <div className="space-y-3">
      {/* Thank-you banner */}
      <div className="flex items-start gap-2.5 bg-fp-blue-tint border border-fp-blue/30 rounded-fp-card p-4">
        <CheckCircle2 className="w-5 h-5 text-fp-blue shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-extrabold text-fp-navy">Purchase complete — thank you!</p>
          <p className="text-fp-muted text-xs mt-0.5 leading-relaxed">
            Bookmark this page or save your links — they never expire.
            {orderHref && (
              <>
                {' '}This photo is part of your order —{' '}
                <Link href={orderHref} className="font-bold text-fp-blue hover:underline">
                  see all downloads →
                </Link>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Downloads */}
      <div className="grid gap-2.5">
        {caps.rawPhoto && (
          <a className={dl} href={`/api/download/${athleteId}/raw?token=${enc}`}>
            <ImageIcon style={icon} /> Hi-res finish photo
          </a>
        )}
        {caps.formatted && (
          <a className={dl} href={`/api/download/${athleteId}?token=${enc}`}>
            <Sparkles style={icon} /> Formatted finish image
          </a>
        )}
        {socialFormats.map((format, i) => (
          <a key={i} className={dl} href={`/api/social/${athleteId}/${i}?token=${enc}`}>
            <Download style={icon} />
            {format === 'story' ? 'Story graphic · 9:16' : 'Post graphic · 1:1'}
          </a>
        ))}
        {caps.frames && hasFrames && (
          <a className={dl} href={`/api/frames/${athleteId}/gif?token=${enc}`}>
            <Clapperboard style={icon} /> Boomerang GIF
          </a>
        )}
      </div>

      {caps.frames && hasFrames && (
        <p className="text-xs text-center text-fp-blue font-semibold">
          ↓ Click any finish-line camera image below to enlarge and download it
        </p>
      )}

      {/* Email links */}
      <div className="border-t border-fp-border pt-4 mt-2">
        <p className="fp-eyebrow text-[11px] text-fp-navy not-italic mb-2">
          Email your download links
        </p>
        {emailSent ? (
          <p className="text-sm text-fp-navy bg-fp-blue-tint border border-fp-blue/30 rounded-[13px] px-4 py-3">
            ✓ Sent! Check your inbox for your download links.
          </p>
        ) : (
          <div className="flex gap-2">
            <input
              type="email"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 min-w-0 text-sm border-2 border-fp-border rounded-[13px] px-3 py-2 focus:outline-none focus:border-fp-blue transition-colors duration-fp-fast"
            />
            <button
              onClick={handleSendEmail}
              disabled={emailSending || !emailInput.trim()}
              className="text-sm font-extrabold italic bg-fp-navy hover:bg-fp-navy-deep text-white px-4 py-2 rounded-[13px] transition-colors duration-fp-fast disabled:opacity-50 disabled:cursor-wait whitespace-nowrap"
            >
              {emailSending ? 'Sending…' : 'Send'}
            </button>
          </div>
        )}
        {emailError && <p className="text-xs text-red-600 mt-1">{emailError}</p>}
      </div>
    </div>
  )
}
