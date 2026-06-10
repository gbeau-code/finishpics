'use client'

import { useState, useEffect, useCallback } from 'react'

interface Props {
  athleteId:  string
  frameCount: number
  lastName:   string
  token:      string | null   // Stripe session ID — null means not yet purchased
}

function LightboxImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className="relative rounded-2xl overflow-hidden">
      {!loaded && <div className="skeleton w-full h-64 rounded-2xl" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={`w-full rounded-2xl shadow-2xl transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}
        onLoad={() => setLoaded(true)}
      />
    </div>
  )
}

function FrameThumb({ src, alt, onClick }: { src: string; alt: string; onClick: () => void }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className="flex-none snap-start relative h-48">
      {!loaded && <div className="skeleton h-48 w-32 rounded-xl" />}
      <button onClick={onClick} className="focus:outline-none group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className={`h-48 w-auto rounded-xl object-cover shadow group-hover:ring-2 group-hover:ring-blue-400 transition-all duration-300 ${loaded ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}
          onLoad={() => setLoaded(true)}
        />
      </button>
    </div>
  )
}

export default function FrameGallery({ athleteId, frameCount, lastName, token }: Props) {
  const [selected, setSelected] = useState<number | null>(null)
  const canDownload = !!token

  const prev  = useCallback(() => setSelected(i => i != null ? Math.max(0, i - 1) : null), [])
  const next  = useCallback(() => setSelected(i => i != null ? Math.min(frameCount - 1, i + 1) : null), [frameCount])
  const close = useCallback(() => setSelected(null), [])

  useEffect(() => {
    if (selected === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  prev()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'Escape')     close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, prev, next, close])

  useEffect(() => {
    document.body.style.overflow = selected !== null ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [selected])

  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : ''

  return (
    <>
      {/* Thumbnail strip */}
      <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory">
        {Array.from({ length: frameCount }, (_, i) => (
          <FrameThumb
            key={i}
            src={`/api/frames/${athleteId}/${i}/preview`}
            alt={`Frame ${i + 1} — click to enlarge`}
            onClick={() => setSelected(i)}
          />
        ))}
      </div>

      {/* Lightbox */}
      {selected !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={close}
        >
          <div
            className="relative max-w-3xl w-full"
            onClick={e => e.stopPropagation()}
          >
            {/* Top bar */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/60 text-sm">
                Frame {selected + 1} of {frameCount}
              </span>
              <button
                onClick={close}
                className="text-white/60 hover:text-white text-2xl leading-none transition-colors"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            {/* Image — preview (watermarked) in lightbox */}
            <LightboxImage
              src={`/api/frames/${athleteId}/${selected}/preview`}
              alt={`Frame ${selected + 1}`}
            />

            {/* Prev / Next */}
            {selected > 0 && (
              <button
                onClick={prev}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white rounded-full w-10 h-10 flex items-center justify-center text-2xl transition-colors"
                aria-label="Previous frame"
              >‹</button>
            )}
            {selected < frameCount - 1 && (
              <button
                onClick={next}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white rounded-full w-10 h-10 flex items-center justify-center text-2xl transition-colors"
                aria-label="Next frame"
              >›</button>
            )}

            {/* Download options */}
            <div className="flex gap-3 mt-4 justify-center flex-wrap">
              {canDownload ? (
                <>
                  <a
                    href={`/api/frames/${athleteId}/${selected}/formatted${tokenParam}`}
                    download={`FinishPics-${lastName}-frame${selected + 1}-formatted.jpg`}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors"
                    onClick={e => e.stopPropagation()}
                  >
                    Download Formatted
                  </a>
                  <a
                    href={`/api/frames/${athleteId}/${selected}${tokenParam}`}
                    download={`FinishPics-${lastName}-frame${selected + 1}-raw.jpg`}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors"
                    onClick={e => e.stopPropagation()}
                  >
                    Download Raw
                  </a>
                </>
              ) : (
                <p className="text-white/50 text-sm">
                  Purchase the full package to download frames
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
