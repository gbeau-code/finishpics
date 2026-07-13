'use client'

import { useEffect } from 'react'
import { useCart } from '@/app/components/CartContext'

/** Clears the local cart once the order confirmation renders. */
export default function ClearCart() {
  const { clear, count } = useCart()
  useEffect(() => {
    if (count > 0) clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
