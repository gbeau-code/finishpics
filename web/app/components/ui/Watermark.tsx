/**
 * SAMPLE watermark — repeating diagonal "SAMPLE · FinishPics.com" tile overlaid
 * on every un-purchased finish photo (client-side counterpart of the Sharp
 * watermark in lib/watermark.ts; this one is purely visual for previews that
 * are ALREADY watermarked server-side or shown at low resolution).
 */

const TILE = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="260" height="180">
  <text x="130" y="90" text-anchor="middle"
        transform="rotate(-24 130 90)"
        font-family="Arial, sans-serif" font-size="18" font-weight="700"
        fill="white" fill-opacity="0.16">SAMPLE · FinishPics.com</text>
</svg>`)

export default function Watermark({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ backgroundImage: `url("data:image/svg+xml,${TILE}")`, backgroundSize: '260px 180px' }}
    />
  )
}
