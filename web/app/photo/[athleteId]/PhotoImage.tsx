'use client'

import { useState } from 'react'

interface Props {
  src: string
  alt: string
}

export default function PhotoImage({ src, alt }: Props) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Shimmer skeleton — visible until image loads */}
      <div
        className={`skeleton w-full transition-opacity duration-300 ${loaded ? 'opacity-0 absolute inset-0' : 'h-44'}`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={`w-full block transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0 h-0'}`}
        onLoad={() => setLoaded(true)}
      />
    </div>
  )
}
