import { NextRequest, NextResponse } from 'next/server'

/**
 * Validate admin auth from a Bearer token in the Authorization header.
 * The expected password is read from the ADMIN_PASSWORD environment variable.
 * Returns null if valid, or a 401 NextResponse if not.
 */
export function requireAdmin(request: NextRequest): NextResponse | null {
  const password = process.env.ADMIN_PASSWORD
  if (!password) {
    // No password configured — lock down completely
    return NextResponse.json({ error: 'Admin access not configured' }, { status: 503 })
  }

  const auth = request.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''

  if (token !== password) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null // valid
}
