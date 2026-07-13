'use client'

/**
 * FinishPreview — live social-graphic preview for the Social Studio.
 *
 * Consumes TEMPLATE_SPECS (px values at BASE_W=360) — the SAME spec the
 * server-side Sharp renderer uses — so this preview pixel-matches the
 * purchased download at 1080w (exactly 3× the 360w preview).
 *
 * The photo layer here is the WATERMARKED preview image; the clean source
 * never reaches the browser.
 */

import { useRef } from 'react'
import { Flag, Heart, MessageCircle, Send, Bookmark, Move } from 'lucide-react'
import {
  BASE_W, COLORS, TAG_LABELS, TEMPLATE_SPECS,
} from '@/lib/graphic-spec'
import type {
  FocalPoint, GraphicFormat, GraphicTag, GraphicTemplate, TextSpec,
} from '@/lib/graphic-spec'

export interface PreviewInfo {
  name:       string
  eventLabel: string
  timeLabel:  string | null
  meetName:   string
}

interface Props {
  photoSrc: string
  info:     PreviewInfo
  format:   GraphicFormat
  template: GraphicTemplate
  tag:      GraphicTag
  focal:    FocalPoint
  onFocal?: (f: FocalPoint) => void
  /** Rendered width in px (default 360 = spec base). */
  width?:   number
  /** Show Instagram-style chrome around the graphic (preview flavor only). */
  chrome?:  boolean
  caption?: string
}

/** TextSpec (px @ BASE_W) → CSS, scaled by k. */
function textCss(spec: TextSpec, k: number): React.CSSProperties {
  return {
    fontSize:      spec.size * k,
    fontWeight:    spec.weight,
    fontStyle:     spec.italic ? 'italic' : 'normal',
    textTransform: spec.uppercase ? 'uppercase' : 'none',
    color:         spec.color,
    letterSpacing: spec.tracking ? `${spec.tracking}em` : undefined,
    lineHeight:    spec.lineHeight ?? 1.2,
    textShadow:    spec.shadow,
    fontVariantNumeric: 'tabular-nums',
  }
}

function FlagTile({ size, radius, bg, color }: { size: number; radius: number; bg: string; color: string }) {
  return (
    <span
      className="inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size, borderRadius: radius, background: bg }}
    >
      <Flag style={{ width: size * 0.62, height: size * 0.62, color }} strokeWidth={2.5} />
    </span>
  )
}

export default function FinishPreview({
  photoSrc, info, format, template, tag, focal, onFocal,
  width = BASE_W, chrome = true, caption,
}: Props) {
  const k = width / BASE_W
  const frameH = format === 'story' ? width * (1920 / 1080) : width
  const spec = TEMPLATE_SPECS[template]
  const tagLabel = TAG_LABELS[tag]
  const frameRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null)

  const initials = info.name.split(' ').map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase()
  const handle   = info.name.toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '.')

  // ── focal drag (matches prototype: photo moves with the pointer) ─────────
  const onPointerDown = (e: React.PointerEvent) => {
    if (!onFocal) return
    drag.current = { sx: e.clientX, sy: e.clientY, px: focal.x, py: focal.y }
    const onMove = (ev: PointerEvent) => {
      if (!drag.current || !frameRef.current) return
      const r  = frameRef.current.getBoundingClientRect()
      const dx = (ev.clientX - drag.current.sx) / r.width  * 100
      const dy = (ev.clientY - drag.current.sy) / r.height * 100
      onFocal({
        x: Math.max(0, Math.min(100, drag.current.px - dx)),
        y: Math.max(0, Math.min(100, drag.current.py - dy)),
      })
    }
    const onUp = () => {
      drag.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    e.preventDefault()
  }

  // ── overlay per template ──────────────────────────────────────────────────
  let overlay: React.ReactNode = null

  if (spec.kind === 'whitegold') {
    overlay = (
      <>
        <div className="absolute inset-0 pointer-events-none" style={{ background: spec.scrim }} />
        <div className="absolute flex items-center pointer-events-none" style={{ top: spec.brand.offset * k, left: spec.brand.offset * k, gap: 7 * k }}>
          <FlagTile size={spec.brand.tile * k} radius={spec.brand.tileRadius * k} bg={COLORS.gold} color={COLORS.ink} />
          <span style={textCss(spec.brand.text, k)}>FinishPics</span>
        </div>
        <div
          className="absolute left-0 right-0 bottom-0 text-center pointer-events-none"
          style={{ padding: `${spec.pad[0] * k}px ${spec.pad[1] * k}px ${spec.pad[2] * k}px` }}
        >
          {tagLabel && (
            <div className="flex items-center justify-center" style={{ gap: spec.tag.gap * k, marginBottom: spec.tag.marginBottom * k }}>
              <span style={{ width: spec.tag.rule[0] * k, height: spec.tag.rule[1] * k, background: COLORS.gold }} />
              <span style={textCss(spec.tag.text, k)}>{tagLabel}</span>
              <span style={{ width: spec.tag.rule[0] * k, height: spec.tag.rule[1] * k, background: COLORS.gold }} />
            </div>
          )}
          {info.timeLabel && <div style={textCss(spec.time, k)}>{info.timeLabel}</div>}
          <div style={{ ...textCss(spec.nameLine, k), marginTop: spec.nameLine.marginTop * k }}>
            {info.name} · {info.eventLabel}
          </div>
          <div style={{ ...textCss(spec.meetLine, k), marginTop: spec.meetLine.marginTop * k }}>
            {info.meetName}
          </div>
        </div>
      </>
    )
  }

  if (spec.kind === 'bar') {
    overlay = (
      <>
        <div
          className="absolute left-0 right-0 bottom-0 pointer-events-none"
          style={{ padding: `${spec.pad[0] * k}px ${spec.pad[1] * k}px ${spec.pad[2] * k}px`, background: spec.scrim }}
        >
          <div className="flex items-center" style={{ gap: spec.eventRow.gap * k }}>
            <FlagTile size={spec.eventRow.tile * k} radius={spec.eventRow.tileRadius * k} bg={COLORS.gold} color={COLORS.ink} />
            <span style={textCss(spec.eventRow.text, k)}>{info.eventLabel}</span>
          </div>
          <div className="flex items-baseline" style={{ gap: spec.timeRow.gap * k, marginTop: spec.timeRow.marginTop * k }}>
            {info.timeLabel && <span style={textCss(spec.timeRow.time, k)}>{info.timeLabel}</span>}
            {tagLabel && <span style={textCss(spec.timeRow.tag, k)}>{tagLabel}</span>}
          </div>
        </div>
        <div className="absolute flex items-center pointer-events-none" style={{ top: spec.brand.offset * k, right: spec.brand.offset * k, gap: 5 * k, opacity: 0.92 }}>
          <FlagTile size={spec.brand.tile * k} radius={spec.brand.tileRadius * k} bg={COLORS.blue} color={COLORS.white} />
          <span style={textCss(spec.brand.text, k)}>FinishPics</span>
        </div>
      </>
    )
  }

  if (spec.kind === 'bigtime') {
    overlay = (
      <>
        <div className="absolute inset-0 pointer-events-none" style={{ background: spec.scrim }} />
        <div
          className="absolute left-0 right-0 text-center pointer-events-none"
          style={{ bottom: spec.bottom * k, padding: `0 ${spec.padX * k}px` }}
        >
          {tagLabel && (
            <span
              className="inline-block"
              style={{
                ...textCss(spec.tagPill.text, k),
                background: COLORS.gold,
                padding: `${spec.tagPill.padY * k}px ${spec.tagPill.padX * k}px`,
                borderRadius: 999,
              }}
            >
              {tagLabel}
            </span>
          )}
          {info.timeLabel && (
            <div style={{ ...textCss(spec.time, k), marginTop: spec.time.marginTop * k }}>
              {info.timeLabel}
            </div>
          )}
          <div style={{ ...textCss(spec.nameLine, k), marginTop: spec.nameLine.marginTop * k }}>
            {info.name} · {info.eventLabel}
          </div>
        </div>
      </>
    )
  }

  // ── frame (photo + overlay) ───────────────────────────────────────────────
  const frame = (
    <div
      ref={frameRef}
      onPointerDown={onPointerDown}
      className="relative overflow-hidden select-none"
      style={{
        width, height: frameH, background: COLORS.navy, flexShrink: 0,
        cursor: onFocal ? 'grab' : 'default', touchAction: 'none',
        borderRadius: format === 'story' ? 20 * k : 0,
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("${photoSrc}")`,
          backgroundSize: 'cover',
          backgroundPosition: `${focal.x}% ${focal.y}%`,
        }}
      />
      {onFocal && (
        <div
          className="absolute left-1/2 -translate-x-1/2 flex items-center pointer-events-none z-10"
          style={{
            top: 11 * k, gap: 4 * k, background: 'rgba(8,12,22,0.46)',
            backdropFilter: 'blur(4px)', color: 'rgba(255,255,255,0.92)',
            fontSize: 9 * k, fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', padding: `${4 * k}px ${9 * k}px`, borderRadius: 999,
          }}
        >
          <Move style={{ width: 10 * k, height: 10 * k }} /> Drag to reposition
        </div>
      )}
      {format === 'story' && chrome && (
        <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ padding: `${12 * k}px ${12 * k}px 0`, background: 'linear-gradient(180deg,rgba(0,0,0,0.35),transparent)' }}>
          <div className="flex" style={{ gap: 4 * k }}>
            <div style={{ flex: 1, height: 3 * k, borderRadius: 3, background: '#fff' }} />
            <div style={{ flex: 1, height: 3 * k, borderRadius: 3, background: 'rgba(255,255,255,0.4)' }} />
            <div style={{ flex: 1, height: 3 * k, borderRadius: 3, background: 'rgba(255,255,255,0.4)' }} />
          </div>
          <div className="flex items-center" style={{ gap: 8 * k, marginTop: 10 * k }}>
            <span className="flex items-center justify-center text-white font-bold" style={{ width: 26 * k, height: 26 * k, borderRadius: 999, background: 'linear-gradient(135deg,#0E63E6,#0A1B3D)', fontSize: 10 * k }}>{initials}</span>
            <span className="text-white font-semibold" style={{ fontSize: 12 * k, textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>{handle}</span>
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 * k }}>· 2h</span>
          </div>
        </div>
      )}
      {overlay}
    </div>
  )

  if (format === 'story' || !chrome) {
    return <div style={{ width, borderRadius: 20 * k, overflow: 'hidden', boxShadow: '0 18px 40px rgba(21,21,21,0.14)' }}>{frame}</div>
  }

  // Feed chrome (Instagram-style shell — preview flavor only, not downloaded)
  return (
    <div style={{ width, background: '#fff', borderRadius: 16 * k, overflow: 'hidden', boxShadow: '0 18px 40px rgba(21,21,21,0.14)', border: '1px solid #E4E8EF' }}>
      <div className="flex items-center" style={{ gap: 10 * k, padding: `${11 * k}px ${13 * k}px` }}>
        <span className="flex items-center justify-center text-white font-bold" style={{ width: 32 * k, height: 32 * k, borderRadius: 999, background: 'linear-gradient(135deg,#0E63E6,#0A1B3D)', fontSize: 12 * k }}>{initials}</span>
        <span style={{ lineHeight: 1.2 }}>
          <span className="block font-bold" style={{ fontSize: 13 * k, color: COLORS.ink }}>{handle}</span>
          <span className="block" style={{ fontSize: 11 * k, color: '#9aa1ab' }}>{info.meetName}</span>
        </span>
      </div>
      {frame}
      <div style={{ padding: `${11 * k}px ${13 * k}px ${13 * k}px` }}>
        <div className="flex items-center" style={{ gap: 16 * k }}>
          <Heart style={{ width: 23 * k, height: 23 * k, color: COLORS.ink }} />
          <MessageCircle style={{ width: 23 * k, height: 23 * k, color: COLORS.ink }} />
          <Send style={{ width: 23 * k, height: 23 * k, color: COLORS.ink }} />
          <Bookmark style={{ width: 23 * k, height: 23 * k, color: COLORS.ink, marginLeft: 'auto' }} />
        </div>
        <div className="font-bold" style={{ fontSize: 13 * k, color: COLORS.ink, marginTop: 9 * k }}>1,248 likes</div>
        {caption && (
          <div style={{ fontSize: 13 * k, color: '#2c2c2c', marginTop: 3 * k, lineHeight: 1.4 }}>
            <span className="font-bold">{handle}</span> {caption}
          </div>
        )}
      </div>
    </div>
  )
}
