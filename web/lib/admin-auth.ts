import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

/**
 * Validate admin auth from a Bearer token in the Authorization header.
 * The expected password is read from the ADMIN_PASSWORD environment variable.
 * Uses timing-safe comparison to prevent timing side-channel attacks.
 * Returns null if valid, or a 401 NextResponse if not.
 */
export function requireAdmin(request: NextRequest): NextResponse | null {
  const password = process.env.ADMIN_PASSWORD
  if (!password) {
    // No password configured — lock down completely
    return NextResponse.json({ error: 'Admin access not configured' }, { status: 503 })
  }

  const auth  = request.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''

  // Timing-safe comparison prevents length/content side-channel attacks
  const expected = Buffer.from(password)
  const received = Buffer.from(token)
  const valid =
    expected.length === received.length &&
    crypto.timingSafeEqual(expected, received)

  if (!valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null // valid
}
