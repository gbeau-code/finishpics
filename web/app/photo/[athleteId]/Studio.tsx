'use client'

/**
 * Studio — the Social Studio rail on the photo page: bundle selector,
 * format/template/tag pickers, live FinishPreview, caption, add-to-cart.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, Copy, Lock, ShoppingBag } from 'lucide-react'
import Button from '@/app/components/ui/Button'
import Chip from '@/app/components/ui/Chip'
import FinishPreview from '@/app/components/FinishPreview'
import type { PreviewInfo } from '@/app/components/FinishPreview'
import { useCart } from '@/app/components/CartContext'
import { BUNDLES } from '@/lib/bundles'
import type { Bundle } from '@/lib/bundles'
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

const BUNDLE_ORDER: Bundle[] = ['raw', 'photosocial', 'works', 'social']

interface Props {
  athleteId:  string
  previewSrc: string
  info:       PreviewInfo
  team:       string | null
  display:    CartLineDisplay
  hasFrames:  boolean
}

export default function Studio({ athleteId, previewSrc, info, team, display, hasFrames }: Props) {
  const { upsertLine, lineForAthlete, count } = useCart()

  const [bundle,   setBundle]   = useState<Bundle>('photosocial')
  const [format,   setFormat]   = useState<GraphicFormat>('post')
  const [template, setTemplate] = useState<GraphicTemplate>('whitegold')
  const [tag,      setTag]      = useState<GraphicTag>('none')
  const [focal,    setFocal]    = useState<FocalPoint>(DEFAULT_FOCAL)
  const [copied,   setCopied]   = useState(false)
  const [toast,    setToast]    = useState<{ edited: boolean } | null>(null)
  const [hydrated, setHydrated] = useState(false)

  // Re-opening a photo already in the cart loads its saved styling
  useEffect(() => {
    if (hydrated) return
    const line = lineForAthlete(athleteId)
    if (line) {
      setBundle(line.bundle)
      const s = line.config.socials[0]
      if (s) {
        setFormat(s.format); setTemplate(s.template); setTag(s.tag); setFocal(s.focal)
      }
    }
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineForAthlete, athleteId, hydrated])

  const bdef = BUNDLES[bundle]
  const studioUnlocked = bdef.caps.socials > 0

  const { caption, hashtags } = useMemo(
    () => buildCaption({
      timeLabel: info.timeLabel, eventLabel: info.eventLabel,
      meetName: info.meetName, team, tag,
    }),
    [info, team, tag],
  )

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(`${caption} ${hashtags}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard unavailable */ }
  }

  const addToCart = () => {
    const editing = lineForAthlete(athleteId)
    // Bundles with a social allotment save the current styling as BOTH the
    // post and story graphic (one of each — the bundle's allotment).
    const config: LineConfig = {
      socials: studioUnlocked
        ? [
            { format: 'post',  template, tag, focal },
            { format: 'story', template, tag, focal },
          ]
        : [],
      caption: studioUnlocked ? `${caption} ${hashtags}` : undefined,
    }
    upsertLine({
      lineId: editing?.lineId ?? crypto.randomUUID(),
      athleteId, bundle, config, display,
      addedAt: Date.now(),
    })
    setToast({ edited: !!editing })
    setTimeout(() => setToast(null), 5000)
  }

  return (
    <div className="space-y-5">
      {/* ── Bundle selector ─────────────────────────────────────────────── */}
      <div>
        <h3 className="fp-display text-[15px] text-fp-ink-strong mb-3">Choose your bundle</h3>
        <div className="space-y-2">
          {BUNDLE_ORDER.map((key) => {
            const b = BUNDLES[key]
            const selected = bundle === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setBundle(key)}
                aria-pressed={selected}
                className={[
                  'w-full flex items-center gap-3 text-left rounded-[13px] border-2 px-4 py-3 transition-colors duration-fp-fast',
                  selected
                    ? 'border-fp-blue bg-fp-blue-tint'
                    : 'border-fp-border bg-white hover:border-fp-faint',
                ].join(' ')}
              >
                <span className="flex-1 min-w-0">
                  <span className={`block text-[14px] font-extrabold ${selected ? 'text-fp-blue' : 'text-fp-ink-strong'}`}>
                    {b.title}
                    {key === 'works' && hasFrames && (
                      <span className="ml-2 text-[10px] font-extrabold italic uppercase tracking-wider bg-fp-gold text-fp-ink-strong px-2 py-0.5 rounded-full">
                        + camera frames
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-fp-muted mt-0.5">{b.description}</span>
                </span>
                <span className={`tnum fp-display text-lg shrink-0 ${selected ? 'text-fp-blue' : 'text-fp-navy'}`}>
                  {b.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Studio controls ─────────────────────────────────────────────── */}
      <div className={studioUnlocked ? '' : 'opacity-60'}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="fp-display text-[15px] text-fp-ink-strong">Style your graphic</h3>
          {!studioUnlocked && (
            <button
              type="button"
              onClick={() => setBundle('works')}
              className="flex items-center gap-1.5 text-xs font-bold text-fp-blue hover:underline"
            >
              <Lock className="w-3 h-3" /> Unlock with Full · {BUNDLES.works.label}
            </button>
          )}
        </div>

        {/* format */}
        <div className="flex gap-2 mb-2">
          <Chip selected={format === 'post'}  onClick={() => setFormat('post')}>Post · 1:1</Chip>
          <Chip selected={format === 'story'} onClick={() => setFormat('story')}>Story · 9:16</Chip>
        </div>
        {/* template */}
        <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
          {TEMPLATES.map(t => (
            <Chip key={t.key} selected={template === t.key} onClick={() => setTemplate(t.key)}>
              {t.label}
            </Chip>
          ))}
        </div>
        {/* tag */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {TAGS.map(t => (
            <Chip key={t.key} selected={tag === t.key} onClick={() => setTag(t.key)}>
              {t.label}
            </Chip>
          ))}
        </div>

        {/* live preview */}
        <div className="flex justify-center">
          <FinishPreview
            photoSrc={previewSrc}
            info={info}
            format={format}
            template={template}
            tag={tag}
            focal={focal}
            onFocal={setFocal}
            width={format === 'story' ? 260 : 330}
            caption={caption}
          />
        </div>

        {/* caption */}
        <div className="mt-4 rounded-fp-card border border-fp-border bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="fp-eyebrow text-[11px] text-fp-navy not-italic">Suggested caption</p>
            <button
              type="button"
              onClick={copyCaption}
              className="flex items-center gap-1.5 border border-fp-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-fp-blue hover:border-fp-blue transition-colors duration-fp-fast"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy caption'}
            </button>
          </div>
          <p className="text-sm text-fp-ink leading-relaxed mt-2">{caption}</p>
          <p className="text-[13px] font-semibold text-fp-blue mt-1.5">{hashtags}</p>
        </div>
      </div>

      {/* ── Price + add to cart ─────────────────────────────────────────── */}
      <div className="border-t border-fp-border pt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[13px] font-extrabold text-fp-navy">{bdef.title} bundle</p>
            <p className="text-xs text-fp-muted mt-0.5">{bdef.description}</p>
          </div>
          <p className="tnum fp-display text-2xl text-fp-navy">{bdef.label}</p>
        </div>
        <Button onClick={addToCart} className="w-full">
          <ShoppingBag className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
          {lineForAthlete(athleteId) ? 'Update cart' : 'Add to cart'}
        </Button>
        <p className="text-xs text-center text-fp-faint mt-2.5">
          Secure checkout powered by Stripe
        </p>
      </div>

      {/* ── Toast ───────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-fp-navy text-white rounded-fp-card shadow-fp-lg px-5 py-3.5 fp-page-in">
          <Check className="w-5 h-5 text-fp-gold" />
          <span className="text-sm font-bold whitespace-nowrap">
            {toast.edited ? 'Cart updated' : 'Added to cart'}
          </span>
          <button type="button" onClick={() => setToast(null)} className="text-sm text-white/70 hover:text-white whitespace-nowrap">
            Keep browsing
          </button>
          <Link href="/cart" className="text-sm font-extrabold text-fp-gold hover:underline whitespace-nowrap">
            View cart ({count})
          </Link>
        </div>
      )}
    </div>
  )
}
