/**
 * Speed lines — thin skewed bars in gold/blue/white at low opacity, layered
 * into navy hero/banner backgrounds (signature motif from the prototype).
 * Render inside a `relative overflow-hidden` navy container.
 */
export default function SpeedLines({ className = '' }: { className?: string }) {
  const bars: Array<{ left: string; width: number; color: string; opacity: number }> = [
    { left: '4%',  width: 3,  color: '#FDB927', opacity: 0.35 },
    { left: '9%',  width: 10, color: '#0E63E6', opacity: 0.28 },
    { left: '15%', width: 2,  color: '#ffffff', opacity: 0.14 },
    { left: '52%', width: 2,  color: '#ffffff', opacity: 0.10 },
    { left: '70%', width: 14, color: '#0E63E6', opacity: 0.16 },
    { left: '78%', width: 3,  color: '#FDB927', opacity: 0.30 },
    { left: '85%', width: 5,  color: '#ffffff', opacity: 0.10 },
    { left: '93%', width: 2,  color: '#FDB927', opacity: 0.22 },
  ]
  return (
    <div aria-hidden className={`absolute inset-0 pointer-events-none ${className}`} style={{ transform: 'skewY(-14deg) scale(1.6)' }}>
      {bars.map((b, i) => (
        <span
          key={i}
          className="absolute top-[-50%] bottom-[-50%]"
          style={{ left: b.left, width: b.width, background: b.color, opacity: b.opacity }}
        />
      ))}
    </div>
  )
}
