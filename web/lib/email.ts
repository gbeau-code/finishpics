/**
 * email.ts — Transactional email via Resend
 *
 * Sends purchase confirmation emails with download links.
 * Requires RESEND_API_KEY and RESEND_FROM_EMAIL env vars.
 */

import { Resend } from 'resend'
import type { Tier } from './stripe'
import { formatTime, formatEventLabel } from './format'

let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY not set')
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

const APP_URL    = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.finishpics.com'
const FROM_EMAIL = () => process.env.RESEND_FROM_EMAIL   ?? 'noreply@finishpics.com'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PurchaseEmailParams {
  to:        string
  athleteId: string
  token:     string   // Stripe session ID — used as download token
  tier:      Tier
  hasFrames: boolean
  athlete: {
    firstName:  string
    lastName:   string
    team:       string | null
    finishTime: number | null
  }
  heat: {
    eventNum:  string
    eventName: string | null
    round:     string
    heatNum:   string
    meetName:  string
    meetDate:  string
  }
}

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------

export async function sendPurchaseEmail(params: PurchaseEmailParams): Promise<void> {
  const { to, athleteId, token, tier, hasFrames, athlete, heat } = params

  const enc          = encodeURIComponent(token)
  const appUrl       = APP_URL()
  const photoPageUrl = `${appUrl}/photo/${athleteId}?session_id=${enc}`
  const rawUrl       = `${appUrl}/api/download/${athleteId}/raw?token=${enc}`
  const formattedUrl = `${appUrl}/api/download/${athleteId}?token=${enc}`
  const gifUrl       = `${appUrl}/api/frames/${athleteId}/gif?token=${enc}`

  const eventLabel = formatEventLabel(heat.eventNum, heat.round, heat.heatNum, heat.eventName)
  const timeStr    = athlete.finishTime != null ? formatTime(athlete.finishTime) : null
  const meetDate   = new Date(heat.meetDate + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  // Download buttons
  const btn  = 'display:inline-block;padding:12px 22px;background:#2563eb;color:#ffffff !important;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;margin:5px 0;'
  const btn2 = btn.replace('#2563eb', '#4f46e5')

  let downloads = `<a href="${rawUrl}" style="${btn}">↓ Download Raw Photo</a><br>`

  if (tier === 'enhanced' || tier === 'full') {
    downloads += `<a href="${formattedUrl}" style="${btn}">↓ Download Formatted Photo</a><br>`
  }
  if (tier === 'full' && hasFrames) {
    downloads += `<a href="${gifUrl}" style="${btn2}">↓ Download Boomerang GIF</a><br>`
  }

  const framesNote = tier === 'full' && hasFrames
    ? `<p style="margin:10px 0 0;font-size:13px;color:#6b7280;">Individual finish-line camera images are available on your <a href="${photoPageUrl}" style="color:#2563eb;text-decoration:none;">photo page</a>.</p>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your FinishPics are ready</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;padding:32px 0;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;">

  <!-- Header -->
  <tr><td style="background:#1e3a5f;border-radius:12px 12px 0 0;padding:26px 32px;">
    <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">FinishPics</p>
    <p style="margin:3px 0 0;font-size:12px;color:#93c5fd;">by In Stride Timing</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#ffffff;padding:30px 32px;">
    <h2 style="margin:0 0 6px;font-size:20px;color:#111827;">Your photos are ready, ${athlete.firstName}!</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Thanks for your purchase. Your download links are below — they don't expire.</p>

    <!-- Athlete card -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:26px;">
      <tr><td style="padding:18px 20px;">
        <p style="margin:0 0 2px;font-size:17px;font-weight:700;color:#111827;">${athlete.firstName} ${athlete.lastName}</p>
        ${athlete.team ? `<p style="margin:0 0 12px;font-size:13px;color:#6b7280;">${athlete.team}</p>` : '<p style="margin:0 0 12px;"></p>'}
        <table cellpadding="0" cellspacing="0" border="0" style="font-size:13px;color:#374151;border-collapse:collapse;">
          <tr>
            <td style="padding:3px 20px 3px 0;color:#9ca3af;white-space:nowrap;">Event</td>
            <td style="padding:3px 0;">${eventLabel}</td>
          </tr>
          <tr>
            <td style="padding:3px 20px 3px 0;color:#9ca3af;white-space:nowrap;">Meet</td>
            <td style="padding:3px 0;">${heat.meetName}</td>
          </tr>
          <tr>
            <td style="padding:3px 20px 3px 0;color:#9ca3af;white-space:nowrap;">Date</td>
            <td style="padding:3px 0;">${meetDate}</td>
          </tr>
          ${timeStr ? `
          <tr>
            <td style="padding:3px 20px 3px 0;color:#9ca3af;white-space:nowrap;">Finish Time</td>
            <td style="padding:3px 0;font-weight:700;font-family:monospace;">${timeStr}</td>
          </tr>` : ''}
        </table>
      </td></tr>
    </table>

    <!-- Downloads -->
    <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#111827;">Your Downloads</p>
    ${downloads}
    ${framesNote}

    <!-- View page link -->
    <p style="margin:24px 0 0;padding-top:20px;border-top:1px solid #f3f4f6;font-size:13px;">
      <a href="${photoPageUrl}" style="color:#2563eb;text-decoration:none;">View your photo page →</a>
    </p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f8fafc;border-top:1px solid #e5e7eb;border-radius:0 0 12px 12px;padding:18px 32px;">
    <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.5;">
      Save this email — your download links don't expire and will work on any device.<br>
      Questions? Reply to this email or contact <a href="mailto:support@finishpics.com" style="color:#9ca3af;">support@finishpics.com</a><br>
      Powered by <a href="https://www.finishpics.com" style="color:#9ca3af;">FinishPics</a> &middot; In Stride Timing
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`

  const { error } = await getResend().emails.send({
    from:    FROM_EMAIL(),
    to,
    subject: `Your FinishPics are ready — ${athlete.firstName} ${athlete.lastName}`,
    html,
  })

  if (error) throw new Error(`Resend error: ${error.message}`)
}

// ---------------------------------------------------------------------------
// v2 combined order email
// ---------------------------------------------------------------------------

export interface OrderEmailItem {
  athleteName: string
  meetName:    string
  eventLabel:  string
  bundleTitle: string
  priceLabel:  string
}

export interface OrderEmailParams {
  to:          string
  orderNumber: string
  token:       string    // order Stripe session ID — download token
  totalLabel:  string    // e.g. "$25.00"
  items:       OrderEmailItem[]
}

/** Confirmation email for a v2 combined order — links to the order page. */
export async function sendOrderEmail(params: OrderEmailParams): Promise<void> {
  const { to, orderNumber, token, totalLabel, items } = params
  const orderUrl = `${APP_URL()}/order/confirm?session_id=${encodeURIComponent(token)}`

  const rows = items.map(it => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
        <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">${it.athleteName}</p>
        <p style="margin:2px 0 0;font-size:12px;color:#6b7280;">${it.meetName} &middot; ${it.eventLabel}</p>
        <p style="margin:2px 0 0;font-size:12px;color:#9ca3af;">${it.bundleTitle} bundle</p>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-size:14px;font-weight:700;color:#111827;white-space:nowrap;">${it.priceLabel}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

  <!-- Header -->
  <tr><td style="background:#0A1B3D;border-radius:12px 12px 0 0;padding:26px 32px;border-bottom:3px solid #FDB927;">
    <p style="margin:0;font-size:20px;font-weight:800;font-style:italic;color:#ffffff;">Finish<span style="color:#FDB927;">Pics</span></p>
    <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">Order confirmed — you own your finish line.</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#ffffff;padding:28px 32px;">
    <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Order <strong style="color:#111827;">${orderNumber}</strong></p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 4px;">
      ${rows}
      <tr>
        <td style="padding:12px 0 0;font-size:14px;font-weight:700;color:#111827;">Total</td>
        <td style="padding:12px 0 0;text-align:right;font-size:16px;font-weight:800;color:#111827;">${totalLabel}</td>
      </tr>
    </table>

    <p style="margin:24px 0 0;">
      <a href="${orderUrl}" style="display:inline-block;padding:13px 26px;background:#FDB927;color:#151515 !important;text-decoration:none;border-radius:10px;font-weight:800;font-size:15px;">Open your downloads →</a>
    </p>
    <p style="margin:14px 0 0;font-size:12px;color:#9ca3af;line-height:1.5;">
      All your files — hi-res photos, formatted images, and social graphics — live on your
      order page. Bookmark it: the links never expire.
    </p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f8fafc;border-top:1px solid #e5e7eb;border-radius:0 0 12px 12px;padding:18px 32px;">
    <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.5;">
      Questions? Reply to this email or contact <a href="mailto:support@finishpics.com" style="color:#9ca3af;">support@finishpics.com</a><br>
      Powered by <a href="https://www.finishpics.com" style="color:#9ca3af;">FinishPics</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`

  const { error } = await getResend().emails.send({
    from:    FROM_EMAIL(),
    to,
    subject: `Your FinishPics order ${orderNumber} is ready`,
    html,
  })

  if (error) throw new Error(`Resend error: ${error.message}`)
}

/**
 * Build + send the order confirmation for a confirmed v2 order — the ONE
 * place order-email content is assembled (webhook and resend both call this).
 */
export async function sendOrderConfirmation(
  order: import('./orders').OrderWithItems,
  to: string,
): Promise<void> {
  if (!order.order_number) throw new Error('sendOrderConfirmation: order not confirmed yet')

  const { getAthleteWithContext } = await import('./database')
  const { BUNDLES } = await import('./bundles')
  const { formatEventLabel, formatCents } = await import('./format')

  const items = await Promise.all(order.items.map(async (item) => {
    const a = await getAthleteWithContext(item.athlete_id)
    return {
      athleteName: a
        ? (a.first_name ? `${a.first_name} ${a.last_name}` : a.last_name)
        : 'Athlete',
      meetName: a?.heat.meet.name ?? '',
      eventLabel: a
        ? formatEventLabel(a.heat.event_num, a.heat.round, a.heat.heat_num, a.heat.event_name)
        : '',
      bundleTitle: BUNDLES[item.bundle].title,
      priceLabel:  formatCents(item.amount_cents),
    }
  }))

  await sendOrderEmail({
    to,
    orderNumber: order.order_number,
    token:       order.stripe_session_id,
    totalLabel:  formatCents(order.amount_cents),
    items,
  })
}
