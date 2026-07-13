import Link from 'next/link'

/**
 * FinishPics button. Variants from the prototype:
 *  - gold:  primary CTA — gold pill, ink text, glow shadow
 *  - blue:  electric-blue solid
 *  - ghost: transparent on navy (white text, subtle border)
 *  - outline: white surface with border (light backgrounds)
 */

type Variant = 'gold' | 'blue' | 'ghost' | 'outline'
type Size    = 'sm' | 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  gold:    'bg-fp-gold text-fp-ink-strong shadow-fp-gold hover:shadow-fp-gold-hover hover:brightness-105',
  blue:    'bg-fp-blue text-white hover:bg-[#0b54c4]',
  ghost:   'bg-white/10 text-white border border-white/20 hover:bg-white/15',
  outline: 'bg-white text-fp-ink-strong border border-fp-border hover:border-fp-blue hover:text-fp-blue',
}

const SIZE: Record<Size, string> = {
  sm: 'text-sm px-4 py-2 rounded-[9px]',
  md: 'text-[15px] px-5 py-2.5 rounded-fp-cta',
  lg: 'text-lg px-7 py-3.5 rounded-fp-cta',
}

interface Props {
  variant?: Variant
  size?: Size
  href?: string
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
  children: React.ReactNode
}

export default function Button({
  variant = 'gold',
  size = 'md',
  href,
  onClick,
  disabled,
  type = 'button',
  className = '',
  children,
}: Props) {
  const cls = [
    'inline-flex items-center justify-center gap-2 font-extrabold italic select-none',
    'transition-all duration-fp-base ease-fp-out',
    'disabled:opacity-60 disabled:cursor-wait disabled:shadow-none',
    VARIANT[variant],
    SIZE[size],
    className,
  ].join(' ')

  if (href && !disabled) {
    return <Link href={href} className={cls}>{children}</Link>
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  )
}
