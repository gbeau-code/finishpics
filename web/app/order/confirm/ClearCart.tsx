'use client'

import { useEffect } from 'react'
import { useCart } from '@/app/components/CartContext'
import { consumeCheckoutPending } from '@/lib/cart'

/**
 * Clears the local cart — but ONLY when this page load is the return from a
 * checkout this browser just started. The confirmation page doubles as the
 * permanent download hub, so revisiting an old order (bookmark, email link)
 * must not wipe a newly built cart.
 */
export default function ClearCart() {
  const { clear, hydrated } = useCart()
  useEffect(() => {
    if (hydrated && consumeCheckoutPending()) clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])
  return null
}
