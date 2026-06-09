import Stripe from 'stripe'

// Lazy singleton — not instantiated at module load time so builds pass
// even without STRIPE_SECRET_KEY in the build environment.
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set')
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-12-18.acacia',
    })
  }
  return _stripe
}

// Convenience re-export for webhook handler (needs the raw Stripe class for constructEvent)
export { Stripe }

export const TIERS = {
  basic: {
    cents:       500,
    label:       '$5.00',
    name:        'Raw Photo-Finish Image',
    description: 'High-resolution raw photo-finish JPEG — no meet or race info included',
  },
  enhanced: {
    cents:       700,
    label:       '$7.00',
    name:        'Photo Package',
    description: 'Raw + formatted photo-finish image with meet and race info included',
  },
  full: {
    cents:       1000,
    label:       '$10.00',
    name:        'Full Package',
    description: 'Raw + formatted photo-finish image, all IdentiLynx frames (raw & formatted), and animated boomerang GIF',
  },
} as const

export type Tier = keyof typeof TIERS
