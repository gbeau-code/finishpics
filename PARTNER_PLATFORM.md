# FinishPics — Partner (Timer) Platform Design

Goal: timing operators join FinishPics, connect a Stripe account, run their own
meets through the same storefront, and sales for their meets flow to them
automatically — with FinishPics keeping a set percentage.

Status: DESIGN (2026-07-13). Build after v2 cutover — this is "P6".
What exists today: one hardcoded partner (Triangle Timing) via `UPLOAD_API_KEYS`
env keys, `meets.company_name` string matching, `ROYALTY_RATE = 0.15` constant in
`/api/admin/revenue`, and manual payouts.

---

## Architecture: Stripe Connect — Express accounts + separate charges & transfers

Three Connect flavors exist; the choice is forced by one product fact: **a cart
can contain athletes from meets owned by different timers**, and checkout must
stay one FinishPics-branded payment.

- ~~Standard accounts + direct charges~~ — checkout happens on the partner's
  account; impossible for multi-partner carts, partner-branded receipts.
- ~~Destination charges~~ — one transfer destination per payment; breaks on
  multi-partner carts.
- ✅ **Separate charges & transfers**: FinishPics charges the customer exactly
  as today (nothing about checkout/webhook/token flow changes), then creates a
  Stripe **Transfer** per timer per order, tagged with a `transfer_group`.
  **Express** accounts give timers Stripe-hosted onboarding (KYC + bank
  account), a lightweight Stripe dashboard for payouts, and Stripe-managed
  1099s — near-zero support burden for a solo platform operator.

Consequences to accept:
- FinishPics (platform account) owns disputes/refunds and fronts Stripe
  processing fees on every charge.
- Refunding a sale requires also reversing the matching transfer(s) — build
  refunds as a platform admin action, never the raw Stripe dashboard (this is
  already a known footgun from FEATURES.md).
- Stripe must have Connect enabled on the platform account (one-time setup).

## Money math (decide before building)

Per order item: `timer_share = item_cents × (1 − fee_pct)`, transferred to the
timer; FinishPics keeps the rest **and pays Stripe's processing fee out of it**.

At your price points the fixed 30¢ matters:

| Item | Stripe fee (2.9%+30¢) | Timer @15% | FinishPics keeps |
|---|---|---|---|
| $5   | ~$0.45 | $4.25 | **$0.30** |
| $10  | ~$0.59 | $8.50 | **$0.91** |
| $15  | ~$0.74 | $12.75 | **$1.51** |

A $5 raw sale nets ~30¢. Options: (a) raise default fee to ~20%, (b) fee =
"15% + payment processing" (deduct Stripe's actual fee before splitting), or
(c) accept thin margins on $5 items since they're upsell bait. Combined carts
help (one 30¢ fee across N items). `fee_pct` is per-timer in the schema, so
Triangle's grandfathered 15% and a different default can coexist.
Note: your own meets have **no timer row** → 100% stays with FinishPics;
nothing changes for existing revenue.

## Schema (additive)

```sql
timers (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,            -- "Triangle Timing"
  email             TEXT NOT NULL,
  upload_api_key    TEXT UNIQUE NOT NULL,     -- moves out of UPLOAD_API_KEYS env
  fee_pct           REAL NOT NULL DEFAULT 0.15,  -- platform's cut
  stripe_account_id TEXT UNIQUE,              -- acct_… once created
  payouts_enabled   BOOLEAN DEFAULT FALSE,    -- from account.updated webhook
  created_at        TEXT NOT NULL
)
meets  + timer_id TEXT REFERENCES timers(id)  -- NULL = FinishPics' own meet
transfers (
  id                 TEXT PRIMARY KEY,
  timer_id           TEXT NOT NULL REFERENCES timers(id),
  order_id           TEXT,                    -- v2 orders
  purchase_id        TEXT,                    -- legacy purchases
  amount_cents       INTEGER NOT NULL,
  stripe_transfer_id TEXT UNIQUE,
  status             TEXT NOT NULL DEFAULT 'pending'  -- pending|paid|reversed|failed
    CHECK (status IN ('pending','paid','reversed','failed')),
  created_at         TEXT NOT NULL
)
```

`meets.timer_id` replaces `company_name` string-matching as the ownership
mechanism (keep `company_name` for display). The agent's API key resolves to a
timer at upload time → `getOrCreateMeet` stamps `timer_id` automatically, so
ownership requires zero partner effort.

## Flows

### 1. Timer joins (invite-first, self-serve later)
1. Admin panel: "Add timer" → creates `timers` row + generates their upload
   API key. (Full self-serve signup is a later layer on the same rails.)
2. System emails the timer a link to `/partner/onboard?token=…` →
   server creates the Express account (`stripe.accounts.create`), then an
   **Account Link** (`stripe.accountLinks.create`) → redirect to Stripe-hosted
   onboarding (identity + bank).
3. `account.updated` webhook → set `payouts_enabled` when
   `charges_enabled/payouts_enabled` go true.
4. Timer gets the agent installer + their API key (this pipeline already
   exists — multi-key auth + PyInstaller partner installer).

### 2. Sale → automatic split (webhook extension)
On `checkout.session.completed` (both order and legacy purchase paths), after
confirming the sale:
1. Group the order's items by `meet.timer_id` (via athlete → heat → meet).
2. For each timer with `payouts_enabled`:
   `amount = Σ item_cents × (1 − fee_pct)` →
   `stripe.transfers.create({ amount, destination: acct, transfer_group: orderId })`
   → record in `transfers`.
3. If a timer exists but isn't onboarded yet: record the `transfers` row as
   `pending` with no stripe id; a retry sweep (admin button or cron) pays
   accumulated pending transfers once onboarding completes. Money is never
   silently kept — it's visibly owed.
4. Idempotency: `transfers` row per (order, timer) unique; webhook retries
   check before creating.

### 3. Refunds (platform admin action)
Admin refund button → `stripe.refunds.create` on the payment intent +
`stripe.transfers.createReversal` per linked transfer (proportional for
partial) + mark purchase/order + transfers `reversed`. Replaces the dashboard-
refund workaround (which today leaves the DB stale — known issue).

### 4. Timer visibility
- Phase 1: extend the existing admin revenue report to group by timer
  (replacing the TRIANGLE_TIMING/ROYALTY_RATE hardcode with `timers` data),
  and email each timer a monthly statement. Payout details live in their
  Stripe Express dashboard (Stripe hosts it — zero build).
- Phase 2: `/partner` dashboard (magic-link auth): their meets, sales,
  transfers, Express-dashboard link, API-key management.

## Build order (post-cutover)
1. `timers` table + `meets.timer_id` + move upload keys to DB (admin CRUD).
2. Connect onboarding (Express account + Account Links + account.updated).
3. Transfer engine in the webhook + `transfers` table + pending-payout sweep.
4. Admin: per-timer revenue view, refund-with-reversal button.
5. Partner statement emails → later the `/partner` dashboard → later
   self-serve signup.

## Open decisions
1. **Fee structure**: flat % of gross (current 15%) vs "% + processing fees"
   vs higher default (~20%). Schema supports any; pick before first new timer.
2. **Payout timing**: transfer immediately on payment (proposed — simplest,
   matches Stripe's flow) vs weekly batches (fewer reversal headaches, more
   bookkeeping). Immediate + Stripe's own payout schedule is the recommendation.
3. **Who is the merchant of record** on receipts/statements: stays FinishPics
   (Express implies this). Partners' customers see "FinishPics".
4. **Partner terms**: a short agreement covering the split, refund policy, and
   image rights, accepted during onboarding.
