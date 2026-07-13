# FinishPics v2 — Overhaul Plan

Redesign delivered as a high-fidelity HTML prototype + design tokens (in
`design_handoff_finishpics/`). This plan turns it into a build strategy on top of
the existing production app.

## Decisions (locked)
1. **Rollout:** Parallel rebuild on a `v2` branch, single cutover. Off-season, no
   meets for months → no meet-day risk, no feature flags needed.
2. **Rendering:** All *delivered* images render **server-side with Sharp**. The clean
   source never reaches the browser. Client canvas is used **only** for the live,
   watermarked preview in the Social Studio.
3. **Cart:** Multi-item cart is **in scope** for v2.

## Non-negotiable constraint
The app is live and has real paying customers with a **"download links never expire"**
promise. The rebuild runs on the **same Neon DB + same Vercel Blob bucket**. The
existing `purchases` table and its per-athlete `stripe_session_id` gating stay intact;
the new order model is **additive**. Legacy links must still download after cutover
(this is an explicit regression test).

## What we keep vs. rebuild
**Keep (proven, untouched):**
- Ingestion pipeline: FinishLynx LSS → local Python agent → `/api/upload*`.
- Backend libs: `database.ts`, `blob-storage.ts`, `stripe.ts`, `email.ts`,
  `watermark.ts`, `formatted-image.ts` (extended), `purchases.ts` (kept for legacy).
- Admin panel + Neon schema + Blob storage + all existing image data.

**Rebuild / extend:**
- Consumer-facing frontend (pages, components, design system).
- Purchase model: add cart + combined orders alongside per-athlete purchases.
- Server-side graphic renderer: new Post/Story templates on top of `formatted-image.ts`.

---

## The four hard problems

### 1. Cart breaks the token model
Today `stripe_session_id` *is* the download key for one athlete. A cart = one payment
unlocking N athletes, each with its own styling. Needs a real order model and an
order-level access token, added **beside** the legacy gating.

### 2. Preview ↔ delivery parity
Interactive preview must be instant (client canvas) but the delivered file is
server-rendered (Sharp). To prevent drift, define **one declarative layout spec**
(positions/sizes as ratios of output dimension, per template+format) consumed by
**both** the client preview and the Sharp renderer. Use the **same font** on both
sides (self-hosted Roboto Condensed, embedded base64 for Sharp + `@font-face` for CSS).

### 3. Styling must persist into the order
Each cart line carries `{bundle, format, template, tag, focal{x,y}, caption, socials[]}`.
Stored as `jsonb` on `order_items` so the server renders exactly what was previewed,
at download time.

### 4. Focal crop on ultra-wide images
Photo-finish frames are extremely wide; cropping to square (Post) / 9:16 (Story) can
cut athletes off. Seed focal point from existing athlete-centering logic; let the user
drag to adjust; store the result.

---

## Schema changes (additive migrations)
Reality check (2026-07-12): `web/lib/schema.sql` is STALE. The live DB (see
`/api/admin/init-db`) uses TEXT ids + TEXT timestamps, and `meets` already has
`location` + `company_name` — so no venue migration is needed (`location` = venue).

Done in P0 — `orders` + `order_items` + `fp_order_number_seq` added to the idempotent
`/api/admin/init-db` route (the project's established migration mechanism; run it once
against the DB when deploying v2):
- `orders`: id, order_number (FP-####, assigned on payment), stripe_session_id
  (unique — doubles as the download token), payment intent, email, amount_cents,
  status pending|paid, created_at.
- `order_items`: order_id, athlete_id, bundle (raw|photosocial|works|social),
  config jsonb ({socials[{format,template,tag,focal}], caption}), amount_cents.

**Access resolution:** `resolveAccess(token, athleteId)` in `web/lib/orders.ts` grants
if EITHER a paid `order_items` row (under order token) OR a legacy `purchases` row
matches; capabilities are unioned. Every v2 download route gates through it.

## Bundle model (from prototype — replaces basic/enhanced/full for new sales)
| key | label | price | photo | formatted | socials |
|---|---|---|---|---|---|
| `raw` | Raw | $5 | ✓ | – | 0 |
| `photosocial` | Photo | $10 | ✓ | ✓ | 0 |
| `works` | Full | $15 | ✓ | ✓ | 2 (1 post + 1 story) |
| `social` | Social | $5 | – | – | 2 |
Keep legacy `TIERS` (basic/enhanced/full) mapping so old rows still resolve. Guard:
the `social` bundle must NOT expose the clean photo download.

---

## Build phases (parallel rebuild order)

### P0 — Foundations ✅ (2026-07-12)
- ✅ Design-token layer: navy/gold/blue palette, radii, shadows, motion easings/
  durations → `web/tailwind.config.ts` (fp-* tokens) + `web/app/globals.css`
  (fonts, .fp-display/.fp-eyebrow/.tnum, scan-line/stagger/page-in animations,
  reduced-motion). README §Design Tokens is authoritative; purple `_ds` tokens
  ignored except type/spacing scale.
- ✅ `web/lib/bundles.ts`: v2 bundle model + Capabilities + legacy tier bridge.
- ✅ `web/lib/graphic-spec.ts`: shared declarative layout spec (types, sanitizers,
  first-pass TEMPLATE_SPECS — refine values in P3 against the prototype).
- ✅ `web/lib/orders.ts`: createOrder/confirmOrder/lookups + `resolveAccess()`.
- ✅ Migration added to `/api/admin/init-db` (idempotent; run at v2 deploy).
- ✅ Design handoff copied into repo at `design/handoff/`.
- ⏳ TODO: true italic cuts of Roboto Condensed (BoldItalic/BlackItalic) for the
  800-italic display style — needs a font download (ask user); until then the
  browser synthesizes the slant and Sharp uses the existing Bold + skew.

### P1 — Design system + shell
- Shared primitives: sticky navy Header (logo, cart bag + gold badge, Find-my-finish
  pill), Button (gold CTA / blue / ghost), Card, Chip/SegmentedControl, navy Banner
  with speed-lines, SAMPLE watermark tile, scan-line + page-transition wrappers.
- Honor `prefers-reduced-motion`; tabular-nums for times/prices; ≥44px hit targets.

### P2 — Browse + search (reskin flow)
- `/` home hero ("OWN YOUR FINISH LINE."), how-it-works 3-step, recent meets.
- `/meets` index grid (thumbnail, name, date, venue).
- `/meet/[meetId]` search: input + event/round/heat chips + staggered results list.

### P3 — Social Studio (photo page) + server renderer
- Extend `formatted-image.ts` → renderer producing `card` (existing), `post`
  (1080×1080), `story` (1080×1920) for templates `whitegold` / `bar` / `bigtime`,
  with tag (none/PB/SB) and focal crop — driven by `graphic-spec.ts`.
- `lib/caption.ts`: auto caption + hashtags.
- `FinishPreview` component: live preview via canvas using the **same spec** +
  watermarked source; draggable focal; format/template/tag pickers; copy caption.
- Bundle selector + "Add to cart" (writes line config to cart store).

### P4 — Cart + combined checkout + fulfillment
- Cart store (client, localStorage): lines `{lineId, athleteId, bundle, config}`;
  edit rehydrates the Studio; header badge. `/cart` review page.
- `/api/checkout`: pre-create pending `orders` + `order_items` in DB, then one Stripe
  session with a line item per cart line; put `order_id` in metadata (avoids Stripe
  metadata size limits).
- Webhook + success reconciliation → mark order paid, assign `FP-####`.
- `/order/[orderNumber]?token=…` confirmation: per-item server-rendered download
  routes gated by `resolveAccess`; native share = fetch server file → `navigator.share`
  (progressive enhancement). Extend `email.ts` to email the order's links.

### P5 — Admin, integrity, polish
- Admin: add venue to meet create/upload; revenue must sum **both** `purchases` and
  `orders`; extend smart-cleanup to treat `order_items` as purchases (see `FEATURES.md`).
- Motion polish, mobile stacked layouts, accessibility pass.

### Cutover
- Build on `v2` branch / Vercel preview against the **same** DB + Blob.
- Seed/test with real past meets.
- **Regression gate:** a legacy `purchases` link still downloads. A new cart order
  downloads every item. `social` bundle hides the clean photo.
- Merge → deploy to production domain. No data migration beyond the additive tables.
- Leave the agent + LSS pipeline untouched so next season ingests day one.

## Key risks
- Preview↔Sharp drift → mitigated by shared spec + shared font (test each template
  by pixel-diffing preview vs. rendered output).
- Focal crop cutting off athletes on ultra-wide frames → sensible default + drag.
- Stripe metadata limits → store order in DB pre-payment, reference by id.
- Legacy link compatibility → explicit regression test at cutover.
