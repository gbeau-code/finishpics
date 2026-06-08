'use client'

import { useState, useEffect, useCallback } from 'react'

interface Props {
  athleteId: string
  frameCount: number
  lastName: string
}

export default function FrameGallery({ athleteId, frameCount, lastName }: Props) {
  const [selected, setSelected] = useState<number | null>(null)

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

  // Prevent body scroll while lightbox is open
  useEffect(() => {
    document.body.style.overflow = selected !== null ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [selected])

  return (
    <>
      {/* Thumbnail strip */}
      <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory">
        {Array.from({ length: frameCount }, (_, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            className="flex-none snap-start focus:outline-none group"
            title={`Frame ${i + 1} — click to enlarge`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/frames/${athleteId}/${i}`}
              alt={`Frame ${i + 1}`}
              className="h-36 w-auto rounded-xl object-cover shadow group-hover:ring-2 group-hover:ring-blue-400 transition-all"
            />
          </button>
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

            {/* Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/frames/${athleteId}/${selected}`}
              alt={`Frame ${selected + 1}`}
              className="w-full rounded-2xl shadow-2xl"
            />

            {/* Prev / Next arrows */}
            {selected > 0 && (
              <button
                onClick={prev}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white rounded-full w-10 h-10 flex items-center justify-center text-2xl transition-colors"
                aria-label="Previous frame"
              >
                ‹
              </button>
            )}
            {selected < frameCount - 1 && (
              <button
                onClick={next}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white rounded-full w-10 h-10 flex items-center justify-center text-2xl transition-colors"
                aria-label="Next frame"
              >
                ›
              </button>
            )}

            {/* Download options */}
            <div className="flex gap-3 mt-4 justify-center flex-wrap">
              <a
                href={`/api/frames/${athleteId}/${selected}/formatted`}
                download={`FinishPics-${lastName}-frame${selected + 1}-formatted.jpg`}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors"
                onClick={e => e.stopPropagation()}
              >
                Download Formatted
              </a>
              <a
                href={`/api/frames/${athleteId}/${selected}`}
                download={`FinishPics-${lastName}-frame${selected + 1}-raw.jpg`}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors"
                onClick={e => e.stopPropagation()}
              >
                Download Raw
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
