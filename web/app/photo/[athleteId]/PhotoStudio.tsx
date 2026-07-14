'use client'

/**
 * PhotoStudio — the photo page's two-zone working area, matching the handoff:
 *   main column: formatted finish-image hero, raw photo hero, bundle picker,
 *                and the "Make it social" stepped configurator + big preview
 *   right rail : "Your result" card, Full upsell, and the order summary / cart
 *
 * Pre-purchase shows the studio; post-purchase (a resolved token) swaps the
 * rail for the Downloads panel and hides the buy controls.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Check, Copy, Flag, Image as ImageIcon, Lock, Package, ShoppingBag,
  Share2, Sparkles, Zap,
} from 'lucide-react'
import Button from '@/app/components/ui/Button'
import Watermark from '@/app/components/ui/Watermark'
import FinishPreview from '@/app/components/FinishPreview'
import Downloads from './Downloads'
import { useCart } from '@/app/components/CartContext'
import { BUNDLES } from '@/lib/bundles'
import type { Bundle, Capabilities } from '@/lib/bundles'
import { buildCaption } from '@/lib/caption'
import { DEFAULT_FOCAL } from '@/lib/graphic-spec'
import type {
  FocalPoint, GraphicFormat, GraphicTag, GraphicTemplate, LineConfig,
} from '@/lib/graphic-spec'
import type { CartLineDisplay } from '@/lib/cart'

const TEMPLATES: Array<{ key: GraphicTemplate; label: string }> = [
  { key: 'whitegold', label: 'White & gold' },
  { key: 'bar',       label: 'Result bar' },
  { key: 'bigtime',   label: 'Big time' },
]
const TAGS: Array<{ key: GraphicTag; label: string }> = [
  { key: 'none', label: 'None' },
  { key: 'pb',   label: 'Personal Best' },
  { key: 'sb',   label: 'Season Best' },
]

export interface StudioInfo {
  name:       string
  team:       string | null
  bib:        string
  eventName:  string        // "Boys 3000 Meter Run"
  eventLabel: string        // full "…· Final · Heat 1"
  roundLabel: string
  heatNum:    string
  timeLabel:  string | null
  meetName:   string
}

interface Props {
  athleteId:  string
  rawSrc:     string
  cardSrc:    string
  info:       StudioInfo
  display:    CartLineDisplay
  hasFrames:  boolean
  // Post-purchase (a resolved access token), else null → show the studio
  access:     { caps: Capabilities; socialFormats: GraphicFormat[]; source: 'order' | 'purchase' } | null
  token:      string | null
  orderHref:  string | null
  purchaseEmail: string | null
}

// Step badge (skewed gold square) from the handoff configurator
function StepBadge({ n, active = true }: { n: number; active?: boolean }) {
  return (
    <span
      className={`tnum flex items-center justify-center w-6 h-6 shrink-0 rounded-[7px] text-[13px] font-extrabold ${active ? 'bg-fp-gold text-fp-ink-strong' : 'bg-fp-border text-fp-muted'}`}
      style={{ transform: 'skewX(-6deg)' }}
    >
      {n}
    </span>
  )
}

function StepLabel({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="leading-tight">
      <div className="fp-eyebrow text-[13px] text-fp-navy not-italic">{title}</div>
      <div className="text-[11px] text-fp-faint">{sub}</div>
    </div>
  )
}

export default function PhotoStudio({
  athleteId, rawSrc, cardSrc, info, display, hasFrames, access, token, orderHref, purchaseEmail,
}: Props) {
  const { upsertLine, lineForAthlete, count, hydrated } = useCart()
  const owned = !!access?.source

  const [bundle,   setBundle]   = useState<Bundle>('works')
  const [format,   setFormat]   = useState<GraphicFormat>('post')
  const [template, setTemplate] = useState<GraphicTemplate>('whitegold')
  const [tag,      setTag]      = useState<GraphicTag>('none')
  const [focal,    setFocal]    = useState<FocalPoint>(DEFAULT_FOCAL)
  const [copied,   setCopied]   = useState(false)
  const [toast,    setToast]    = useState<{ edited: boolean } | null>(null)
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    if (!hydrated || restored) return
    const line = lineForAthlete(athleteId)
    if (line) {
      setBundle(line.bundle)
      const s = line.config.socials[0]
      if (s) { setFormat(s.format); setTemplate(s.template); setTag(s.tag); setFocal(s.focal) }
    }
    setRestored(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, restored, athleteId])

  const bdef = BUNDLES[bundle]
  const studioUnlocked = bdef.caps.socials > 0
  const inCart = !!lineForAthlete(athleteId)

  const { caption, hashtags } = useMemo(
    () => buildCaption({ timeLabel: info.timeLabel, eventLabel: info.eventName, meetName: info.meetName, team: info.team, tag }),
    [info, tag],
  )

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(`${caption} ${hashtags}`)
      setCopied(true); setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard unavailable */ }
  }

  const addToCart = () => {
    const editing = lineForAthlete(athleteId)
    const config: LineConfig = {
      socials: studioUnlocked
        ? [{ format: 'post', template, tag, focal }, { format: 'story', template, tag, focal }]
        : [],
      caption: studioUnlocked ? `${caption} ${hashtags}` : undefined,
    }
    upsertLine({ lineId: editing?.lineId ?? crypto.randomUUID(), athleteId, bundle, config, display, addedAt: Date.now() })
    setToast({ edited: !!editing }); setTimeout(() => setToast(null), 5000)
  }

  // ── Heros (shared by owned + studio states) ──────────────────────────────
  const heros = (
    <>
      {/* Formatted finish image */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-[18px] h-[18px] text-fp-blue" />
          <h2 className="fp-display text-xl text-fp-ink-strong">Your finish image</h2>
          <span className="ml-auto fp-eyebrow text-[11px] text-[#1F8A5B] bg-[#E8F5EE] px-2.5 py-1 rounded-full">
            Formatted &amp; social pack
          </span>
        </div>
        <div className="relative rounded-fp-card overflow-hidden bg-fp-navy shadow-fp-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cardSrc} alt={`Formatted finish image for ${info.name}`} className="block w-full h-auto" />
        </div>
        <p className="mt-2 text-center text-[11px] text-fp-faint">
          Sample watermark, removed on purchase — included with the Photo and Full bundles.
        </p>
      </section>

      {/* Raw photo */}
      <section className="mt-8">
        <div className="flex items-center gap-2 mb-3">
          <ImageIcon className="w-[18px] h-[18px] text-fp-blue" />
          <h2 className="fp-display text-xl text-fp-ink-strong">Raw photo</h2>
          <span className="text-xs text-fp-faint">the $5 option — same image, no overlay</span>
        </div>
        <div className="relative rounded-fp-card overflow-hidden bg-fp-navy shadow-fp-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={rawSrc} alt={`Photo-finish image for ${info.name}`} className="block w-full h-auto" />
          <div className="fp-scanline" />
          <div className="absolute top-3.5 left-3.5 flex items-center gap-1.5 bg-fp-navy/70 backdrop-blur px-2.5 py-1.5 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-fp-gold" />
            <span className="fp-eyebrow text-[10px] text-white">Photo-finish · Hi-res</span>
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] text-fp-faint">
          Captured line-by-line as you crossed. Sample watermark removed on purchase.
        </p>
      </section>
    </>
  )

  // ── Owned: heros + rail Downloads ────────────────────────────────────────
  if (owned && token && access) {
    return (
      <div className="grid lg:grid-cols-[1fr_372px] gap-9 items-start">
        <div className="min-w-0">{heros}</div>
        <aside className="lg:sticky lg:top-[86px]">
          <div className="bg-fp-stage rounded-fp-card p-6">
            <Downloads
              athleteId={athleteId}
              token={token}
              caps={access.caps}
              socialFormats={access.socialFormats}
              hasFrames={hasFrames}
              orderHref={orderHref}
              purchaseEmail={purchaseEmail}
            />
          </div>
        </aside>
      </div>
    )
  }

  // ── Pre-purchase studio ──────────────────────────────────────────────────
  const bundleCard = (key: Bundle, opts: { popular?: boolean } = {}) => {
    const b = BUNDLES[key]
    const selected = bundle === key
    return (
      <button
        key={key}
        type="button"
        onClick={() => setBundle(key)}
        aria-pressed={selected}
        className={`relative text-left rounded-[14px] border-2 px-3.5 py-3.5 transition-colors duration-fp-fast ${selected ? 'border-fp-blue bg-fp-blue-tint' : 'border-fp-border bg-white hover:border-fp-faint'}`}
      >
        {opts.popular && (
          <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-fp-blue text-white text-[9px] font-extrabold italic tracking-wide px-2.5 py-0.5 rounded-full whitespace-nowrap">
            MOST POPULAR
          </span>
        )}
        <span className="flex items-center justify-between">
          <span className="fp-eyebrow text-[11px] text-fp-navy">{b.title}</span>
          <span className="tnum text-lg font-extrabold text-fp-ink-strong">{b.label}</span>
        </span>
        <span className="block text-xs text-fp-muted mt-1.5 leading-snug">{b.description}</span>
      </button>
    )
  }

  return (
    <div className="grid lg:grid-cols-[1fr_372px] gap-9 items-start">
      {/* ── Main column ─────────────────────────────────────────────────── */}
      <div className="min-w-0">
        {heros}

        {/* Bundle picker */}
        <section className="mt-9">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-[17px] h-[17px] text-fp-blue" />
            <h3 className="fp-display text-[15px] text-fp-ink-strong">Choose your bundle</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch">
            {bundleCard('raw')}
            {bundleCard('photosocial')}
            {bundleCard('works', { popular: true })}
          </div>
          <button
            type="button"
            onClick={() => setBundle('social')}
            aria-pressed={bundle === 'social'}
            className={`mt-3 w-full flex items-center gap-3 text-left rounded-[14px] border-2 px-4 py-3 transition-colors duration-fp-fast ${bundle === 'social' ? 'border-fp-blue bg-fp-blue-tint' : 'border-fp-border bg-[#F7F9FC] hover:border-fp-faint'}`}
          >
            <span className="w-9 h-9 shrink-0 rounded-[11px] bg-fp-navy flex items-center justify-center">
              <Share2 className="w-[19px] h-[19px] text-fp-gold" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block fp-eyebrow text-[12px] text-fp-navy">
                Just want to post? <span className="text-fp-blue">Social only</span>
              </span>
              <span className="block text-xs text-fp-muted mt-0.5">One post + one story graphic. No photo file.</span>
            </span>
            <span className="tnum text-lg font-extrabold text-fp-ink-strong shrink-0">{BUNDLES.social.label}</span>
          </button>
        </section>

        {/* Make it social */}
        <section className="mt-9 pt-7 border-t border-dashed border-fp-border">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-[18px] h-[18px] text-fp-blue" />
            <h2 className="fp-display text-xl text-fp-ink-strong">Make it social</h2>
            <span className="tnum ml-auto fp-eyebrow text-[11px] text-fp-blue bg-fp-blue-tint px-2.5 py-1 rounded-full">
              {bdef.caps.socials > 0 ? `${bdef.caps.socials} included` : 'Locked'}
            </span>
          </div>
          <p className="text-[13px] text-fp-muted leading-relaxed mb-4 max-w-xl">
            Pick the format, overlay and tag. <span className="font-bold text-fp-blue">Full and Social include one post and one story.</span>
          </p>

          <div className={studioUnlocked ? '' : 'relative'}>
            {!studioUnlocked && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/60 backdrop-blur-[1px]">
                <button
                  type="button"
                  onClick={() => setBundle('works')}
                  className="flex items-center gap-2 bg-fp-navy text-white text-sm font-extrabold italic px-4 py-2.5 rounded-fp-cta shadow-fp-md"
                >
                  <Lock className="w-4 h-4" /> Unlock with Full · {BUNDLES.works.label}
                </button>
              </div>
            )}

            <div className={studioUnlocked ? '' : 'pointer-events-none opacity-50 select-none'}>
              {/* Stepped configurator */}
              <div className="rounded-2xl border border-fp-border bg-white shadow-fp-sm overflow-hidden mb-4">
                {/* Step 1 — format */}
                <div className="flex items-center gap-4 px-4 py-3.5">
                  <div className="w-[150px] shrink-0 flex items-center gap-2.5">
                    <StepBadge n={1} />
                    <StepLabel title="Format" sub="Where you'll post" />
                  </div>
                  <div className="inline-flex gap-1 bg-[#F1F4F8] p-1 rounded-xl">
                    {(['post', 'story'] as GraphicFormat[]).map(f => (
                      <button key={f} type="button" onClick={() => setFormat(f)}
                        className={`px-3.5 py-1.5 rounded-lg text-sm font-bold transition-colors duration-fp-fast ${format === f ? 'bg-white text-fp-blue shadow-fp-xs' : 'text-fp-muted'}`}>
                        {f === 'post' ? 'Post' : 'Story'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-px bg-[#EEF1F5]" />
                {/* Step 2 — overlay */}
                <div className="flex items-start gap-4 px-4 py-3.5">
                  <div className="w-[150px] shrink-0 flex items-center gap-2.5 pt-1">
                    <StepBadge n={2} />
                    <StepLabel title="Overlay" sub="How the result reads" />
                  </div>
                  <div className="flex-1 flex gap-2 flex-wrap">
                    {TEMPLATES.map(t => (
                      <button key={t.key} type="button" onClick={() => setTemplate(t.key)}
                        className={`px-3.5 py-1.5 rounded-[9px] border text-sm font-bold transition-colors duration-fp-fast ${template === t.key ? 'bg-fp-blue-tint border-fp-blue text-fp-blue' : 'bg-white border-fp-border text-fp-muted hover:border-fp-faint'}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-px bg-[#EEF1F5]" />
                {/* Step 3 — tag */}
                <div className="flex items-start gap-4 px-4 py-3.5">
                  <div className="w-[150px] shrink-0 flex items-center gap-2.5 pt-1">
                    <StepBadge n={3} active={false} />
                    <StepLabel title="Tag · optional" sub="Athlete-added badge" />
                  </div>
                  <div className="flex-1 flex gap-2 flex-wrap">
                    {TAGS.map(t => (
                      <button key={t.key} type="button" onClick={() => setTag(t.key)}
                        className={`px-3.5 py-1.5 rounded-[9px] border text-sm font-bold transition-colors duration-fp-fast ${tag === t.key ? 'bg-fp-blue-tint border-fp-blue text-fp-blue' : 'bg-white border-fp-border text-fp-muted hover:border-fp-faint'}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Big preview */}
              <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-b from-fp-navy-mid to-fp-navy flex justify-center items-center px-6 py-9 min-h-[480px]">
                <div className="absolute top-5 -left-8 w-52 h-1.5 bg-fp-gold/50" style={{ transform: 'skewY(-14deg)' }} />
                <div className="absolute bottom-8 -right-8 w-56 h-1.5 bg-fp-blue/50" style={{ transform: 'skewY(-14deg)' }} />
                <FinishPreview
                  photoSrc={rawSrc}
                  info={{ name: info.name, eventLabel: info.eventName, timeLabel: info.timeLabel, meetName: info.meetName }}
                  format={format}
                  template={template}
                  tag={tag}
                  focal={focal}
                  onFocal={setFocal}
                  width={format === 'story' ? 300 : 380}
                  caption={caption}
                />
              </div>

              {/* Caption */}
              <div className="mt-5 rounded-[14px] border border-fp-border bg-[#F7F9FC] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="fp-eyebrow text-[12px] text-fp-navy not-italic">Suggested caption</p>
                  <button type="button" onClick={copyCaption}
                    className="flex items-center gap-1.5 bg-white border border-fp-border rounded-lg px-3 py-1.5 text-[13px] font-bold text-fp-blue hover:border-fp-blue transition-colors duration-fp-fast">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy caption'}
                  </button>
                </div>
                <p className="text-sm text-fp-ink leading-relaxed mt-2.5">{caption}</p>
                <p className="text-[13px] font-semibold text-fp-blue mt-2">{hashtags}</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── Right rail ──────────────────────────────────────────────────── */}
      <aside className="lg:sticky lg:top-[86px] space-y-3.5">
        {/* Your result */}
        <div className="relative overflow-hidden rounded-fp-card bg-fp-navy p-5">
          <div className="absolute top-3.5 -right-8 w-36 h-1.5 bg-fp-gold/55" style={{ transform: 'skewY(-14deg)' }} />
          <p className="fp-eyebrow text-[11px] text-fp-gold mb-3">Your result</p>
          <div className="flex items-center gap-3.5">
            <span className="w-12 h-12 shrink-0 rounded-[13px] bg-gradient-to-br from-fp-gold to-[#f59e0b] flex items-center justify-center shadow-fp-gold" style={{ transform: 'skewX(-6deg)' }}>
              <Flag className="w-6 h-6 text-fp-ink-strong" style={{ transform: 'skewX(6deg)' }} />
            </span>
            <div className="leading-none min-w-0">
              <div className="text-[13px] text-white/60 font-semibold truncate">{info.eventName}</div>
              {info.timeLabel && <div className="tnum text-4xl font-extrabold text-white tracking-tight mt-1">{info.timeLabel}</div>}
            </div>
          </div>
          <div className="flex gap-1.5 mt-3.5 flex-wrap">
            {info.team && <span className="text-xs font-semibold text-white/80 bg-white/10 px-2.5 py-1 rounded-full">{info.team}</span>}
            <span className="text-xs font-semibold text-white/80 bg-white/10 px-2.5 py-1 rounded-full">{info.roundLabel} · Heat {info.heatNum}</span>
          </div>
        </div>

        {/* Full upsell (when the current pick isn't the works bundle) */}
        {bundle !== 'works' && (
          <div className="relative overflow-hidden rounded-fp-card bg-gradient-to-br from-fp-blue to-fp-navy p-4">
            <div className="absolute top-3 -right-7 w-28 h-1.5 bg-fp-gold/50" style={{ transform: 'skewY(-14deg)' }} />
            <p className="fp-eyebrow text-[10px] text-fp-gold">Upgrade</p>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="fp-display text-lg text-white">Full</span>
              <span className="tnum text-lg font-extrabold text-fp-gold">{BUNDLES.works.label}</span>
            </div>
            <p className="text-xs text-white/85 leading-relaxed mt-1.5">
              Everything: hi-res photo, formatted image, and a post &amp; story graphic — plus finish-line camera frames.
            </p>
            <button type="button" onClick={() => setBundle('works')}
              className="mt-3 w-full bg-fp-gold text-fp-ink-strong rounded-[10px] py-2.5 text-sm font-extrabold italic flex items-center justify-center gap-2 hover:brightness-105 transition">
              <Zap className="w-4 h-4" /> Add the Full set
            </button>
          </div>
        )}

        {/* Order summary */}
        <div className="rounded-fp-card border border-fp-border bg-white p-[18px] shadow-fp-sm">
          <div className="flex items-center gap-2 mb-3.5">
            <ImageIcon className="w-4 h-4 text-fp-navy" />
            <span className="fp-eyebrow text-sm text-fp-ink-strong not-italic">This finish</span>
            {count > 0 && (
              <Link href="/cart" className="tnum ml-auto text-xs font-bold text-fp-blue hover:underline">Cart ({count})</Link>
            )}
          </div>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-fp-blue-tint border border-[#b3d4ff]">
            <span className="w-8 h-8 shrink-0 rounded-[9px] bg-fp-blue flex items-center justify-center">
              <Package className="w-[18px] h-[18px] text-white" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-extrabold text-fp-navy leading-tight">{bdef.title} bundle</span>
              <span className="block text-[11px] text-[#5b7197] mt-0.5">{bdef.description}</span>
            </span>
            <span className="tnum text-[15px] font-extrabold text-fp-navy shrink-0">{bdef.label}</span>
          </div>
          <Button onClick={addToCart} className="w-full mt-4">
            <ShoppingBag style={{ width: 18, height: 18 }} />
            {inCart ? 'Update cart' : 'Add to cart'}
          </Button>
          <p className="text-[11px] text-center text-fp-faint mt-2.5">Secure checkout powered by Stripe</p>
        </div>
      </aside>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-fp-navy text-white rounded-fp-card shadow-fp-lg px-5 py-3.5 fp-page-in">
          <Check className="w-5 h-5 text-fp-gold" />
          <span className="text-sm font-bold whitespace-nowrap">{toast.edited ? 'Cart updated' : 'Added to cart'}</span>
          <button type="button" onClick={() => setToast(null)} className="text-sm text-white/70 hover:text-white whitespace-nowrap">Keep browsing</button>
          <Link href="/cart" className="text-sm font-extrabold text-fp-gold hover:underline whitespace-nowrap">View cart ({count})</Link>
        </div>
      )}
    </div>
  )
}
