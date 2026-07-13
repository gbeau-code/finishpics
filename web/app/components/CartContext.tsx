'use client'

/**
 * CartContext — cart state shared across the app (header badge, photo page,
 * cart page). Hydrates from localStorage after mount to avoid SSR mismatch.
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { CartLine } from '@/lib/cart'
import { loadCart, saveCart } from '@/lib/cart'

interface CartApi {
  lines: CartLine[]
  count: number
  /** Add a line, or replace the existing line for the same athlete. */
  upsertLine: (line: CartLine) => void
  removeLine: (lineId: string) => void
  updateLine: (lineId: string, patch: Partial<Omit<CartLine, 'lineId'>>) => void
  clear: () => void
  /** Find an existing line for an athlete (used to rehydrate the editor). */
  lineForAthlete: (athleteId: string) => CartLine | undefined
}

const CartContext = createContext<CartApi | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])

  // Hydrate from localStorage after mount (SSR renders an empty cart)
  useEffect(() => { setLines(loadCart()) }, [])

  const persist = useCallback((next: CartLine[]) => {
    setLines(next)
    saveCart(next)
  }, [])

  const upsertLine = useCallback((line: CartLine) => {
    setLines(prev => {
      const next = [...prev.filter(l => l.athleteId !== line.athleteId), line]
      saveCart(next)
      return next
    })
  }, [])

  const removeLine = useCallback((lineId: string) => {
    setLines(prev => {
      const next = prev.filter(l => l.lineId !== lineId)
      saveCart(next)
      return next
    })
  }, [])

  const updateLine = useCallback((lineId: string, patch: Partial<Omit<CartLine, 'lineId'>>) => {
    setLines(prev => {
      const next = prev.map(l => l.lineId === lineId ? { ...l, ...patch } : l)
      saveCart(next)
      return next
    })
  }, [])

  const clear = useCallback(() => persist([]), [persist])

  const api: CartApi = {
    lines,
    count: lines.length,
    upsertLine,
    removeLine,
    updateLine,
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
