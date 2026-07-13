'use client'

/**
 * CartContext — cart state shared across the app (header badge, photo page,
 * cart page). Hydrates from localStorage after mount to avoid SSR mismatch;
 * consumers that need the persisted lines (e.g. Studio rehydration) must wait
 * for `hydrated` — child effects run before this provider's own effect.
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { CartLine } from '@/lib/cart'
import { loadCart, saveCart } from '@/lib/cart'

interface CartApi {
  lines: CartLine[]
  count: number
  /** True once the cart has been loaded from localStorage. */
  hydrated: boolean
  /** Add a line, or replace the existing line for the same athlete. */
  upsertLine: (line: CartLine) => void
  removeLine: (lineId: string) => void
  clear: () => void
  /** Find an existing line for an athlete (used to rehydrate the editor). */
  lineForAthlete: (athleteId: string) => CartLine | undefined
}

const CartContext = createContext<CartApi | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from localStorage after mount (SSR renders an empty cart)
  useEffect(() => {
    setLines(loadCart())
    setHydrated(true)
  }, [])

  // Single persistence point — every mutation below just sets state
  useEffect(() => {
    if (hydrated) saveCart(lines)
  }, [lines, hydrated])

  const upsertLine = useCallback((line: CartLine) => {
    setLines(prev => [...prev.filter(l => l.athleteId !== line.athleteId), line])
  }, [])

  const removeLine = useCallback((lineId: string) => {
    setLines(prev => prev.filter(l => l.lineId !== lineId))
  }, [])

  const clear = useCallback(() => setLines([]), [])

  const api: CartApi = {
    lines,
    count: lines.length,
    hydrated,
    upsertLine,
    removeLine,
    clear,
    lineForAthlete: (athleteId) => lines.find(l => l.athleteId === athleteId),
  }

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>')
  return ctx
}
