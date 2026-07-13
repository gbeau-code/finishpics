'use client'

import Link from 'next/link'
import { ShoppingBag } from 'lucide-react'
import Logo from './ui/Logo'
import Button from './ui/Button'
import { useCart } from './CartContext'

/**
 * Sticky site header (prototype spec): 64px, navy rgba(10,27,61,0.97) with
 * backdrop blur, 3px gold bottom border. Logo · Help · cart bag with gold
 * count badge · gold "Find my finish" pill.
 */
export default function Header() {
  const { count } = useCart()

  return (
    <header
      className="sticky top-0 z-50 border-b-[3px] border-fp-gold"
      style={{ background: 'rgba(10,27,61,0.97)', backdropFilter: 'blur(12px)' }}
    >
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Logo />

          <nav className="flex items-center gap-2 sm:gap-4">
            <Link
              href="mailto:support@finishpics.com"
              className="hidden sm:block text-sm font-bold text-white/75 hover:text-white transition-colors duration-fp-fast"
            >
              Help
            </Link>

            {/* Cart */}
            <Link
              href="/cart"
              aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}
              className="relative p-2 text-white/85 hover:text-white transition-colors duration-fp-fast"
            >
              <ShoppingBag className="w-5 h-5" strokeWidth={2.25} />
              {count > 0 && (
                <span className="tnum absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-fp-gold text-fp-ink-strong text-[11px] font-extrabold leading-none">
                  {count}
                </span>
              )}
            </Link>

            <Button href="/meets" size="sm">Find my finish</Button>
          </nav>
        </div>
      </div>
    </header>
  )
}
