# Handoff: FinishPics — Photo-Finish Image Marketplace

## Overview
FinishPics is a consumer-facing storefront where track & field athletes (and their
families) find their official **photo-finish** image from a meet, style it into a
share-ready graphic, and buy/download it. The flow: land on the home page → pick a
meet → search your name/event → open your finish photo → choose a bundle and style a
social graphic → cart → checkout → confirmation with downloads.

The design is delivered as an interactive HTML prototype covering the full desktop
purchase flow plus a mobile (iPhone) rendering of the same flow.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working
prototype that demonstrates the intended look, layout, copy, and behavior. **They are
not production code to copy directly.** The `.dc.html` format uses a small in-house
runtime (`support.js`) purely so the prototype runs in a browser; do **not** port that
runtime.

Your task is to **recreate these designs in the target codebase's environment** —
React, Vue, Svelte, a server-rendered stack, native, etc. — using its established
component library, routing, state, and styling conventions. If no codebase exists yet,
choose the framework best suited to a marketing-flavored transactional storefront
(a React/Next.js or similar SSR stack is a natural fit) and build there.

To view the prototype: open `Photo Page v2.dc.html` in a browser (it loads
`support.js`, `FinishPreview.dc.html`, the token CSS, and the images relative to
itself). A device toggle in the header switches between the Desktop and Mobile
renderings.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, shadows, copy, and interactions
are all final-intent. Recreate the UI pixel-accurately using the target codebase's
libraries. The exact values are enumerated under **Design Tokens** below.

> **Palette note:** The bundled FinishLynx design-system token files (in `_ds/…/tokens/`)
> define a **purple** brand system. This prototype intentionally **diverges** and uses a
> **navy + gold + electric-blue** athletic palette (documented below). Treat the
> **navy/gold/blue values in this README as the source of truth for FinishPics.** The
> token CSS is included for reference/spacing/type scale, not for its purple hues.

---

## Design Tokens

### Colors (FinishPics palette — authoritative)
- **Navy (primary surface / headers / banners):** `#0A1B3D`
  - Gradient variant: `linear-gradient(135deg, #0A1B3D 0%, #0c2350 60%, #0A1B3D 100%)`
  - Deep card variant: `#0d2147`
- **Gold (highlight / primary CTA):** `#FDB927`  (text on gold: `#151515`)
- **Electric blue (accent / selected states / links):** `#0E63E6`
  - Selected-chip fill: `#EAF1FE` (bg) with `#0E63E6` border+text
- **Ink / body text:** `#2c2c2c`  · **Strong:** `#151515`
- **Muted text:** `#5b6270` / `#5b5b5b` · **Faint:** `#9aa1ab`
- **Page background:** `#ffffff` · **Mobile stage bg:** `#EDF0F5` / `#EDF0F5`
- **Border / divider:** `#E4E8EF` · stronger dividers use `rgba(255,255,255,0.2)` on navy
- **On-navy text:** `#ffffff`, secondary `rgba(255,255,255,0.75)`, tertiary `rgba(255,255,255,0.5)`

### Typography
- **Family:** `"Roboto", "Roboto Condensed", "Segoe UI", system-ui, sans-serif`
  - Loaded from Google Fonts (Roboto variable, ital + wdth 75–100 + wght 300–900).
  - Body uses **condensed width**: `font-stretch: 87.5%`.
- **Display / headings:** weight **800**, `font-style: italic`, `text-transform: uppercase`,
  tight tracking (`letter-spacing: -0.02em`). Hero H1 ≈ **74px**, `line-height: 0.94`.
- **Section headings:** 800 italic uppercase, ~28–40px.
- **Eyebrows / labels:** 800 italic, uppercase, `letter-spacing: 0.14–0.18em`, 11–12px,
  usually gold or blue.
- **Body copy:** 400–600, 14–19px, `line-height: 1.5`.
- **Buttons:** 800, often italic, 14–18px.
- **Times / results / numbers:** `font-variant-numeric: tabular-nums` (class `.tnum`) —
  always use tabular figures for finish times, places, prices.
- **Type scale reference** (from `tokens/typography.css`): 11 / 12 / 14 / 16 / 18 / 22 / 28 / 36 / 48 / 64 / 84 px.

### Radii
`3` (xs) · `6` (sm) · `8–9` (chips/buttons) · `10` (md) · `13` (primary CTA) · `16–18`
(cards) · `24` (xl) · `999` (pills). Icon-logo tile: `9px`.

### Shadows (cool, low-spread)
- xs `0 1px 2px rgba(21,21,21,0.06)` · sm `0 2px 6px rgba(21,21,21,0.08)`
- md `0 8px 20px rgba(21,21,21,0.10)` · lg `0 18px 40px rgba(21,21,21,0.14)`
- Gold CTA glow: `0 14px 34px rgba(253,185,39,0.35)` (hover `…0.45`)
- Blue logo glow: `0 4px 12px rgba(14,99,230,0.45)`

### Motion
- Easing: `cubic-bezier(0.16,0.84,0.44,1)` (out), `cubic-bezier(0.22,0.61,0.36,1)` (page in).
- Durations: fast 120ms · base 200ms · slow 360ms.
- Named animations in the prototype:
  - **Page transition** (`_nav`): current screen fades/lifts out (~165ms), swap +
    scroll-to-top, new content fades in (~360ms).
  - **Results stagger:** list items fade up with 120ms→920ms incremental delays.
  - **Scan line:** a gold vertical line sweeps across the photo (photo-finish motif) on load.
  - **Spinner** (`.spin`): 0.7s linear for the checkout "placing order" state.
  - Respects `prefers-reduced-motion` (durations collapse to ~0).

### Signature visual motifs
- **Speed lines:** thin skewed bars (`transform: skewY(-14deg)`) in gold/blue/white at
  low opacity, layered in navy hero/banner backgrounds.
- **Angled logo tile:** blue rounded square, `transform: skewX(-6deg)`, flag icon inside.
- **Sample watermark:** repeating diagonal "SAMPLE · FinishPics.com" SVG tile overlaid on
  all un-purchased finish photos (`.wm`).

### Icons
[Lucide](https://lucide.dev) icon set (loaded via CDN `lucide.min.js`, rendered with
`data-lucide="…"`). Icons seen: `flag`, `monitor`, `smartphone`, `shopping-bag`,
`arrow-right`, `search`, `check`, `plus`, `lock`, `refresh-cw`, `download`, `share`,
etc. Use the target codebase's existing icon library (lucide-react, etc.).

---

## Brand / Logo
Wordmark **"Finish"** in white + **"Pics"** in gold (`#FDB927`), 800 italic, with a
tiny uppercase tagline "OFFICIAL PHOTO-FINISH IMAGES". Preceded by the skewed blue
flag tile. Alternate logo directions live in `Logo Explorations.dc.html` in the parent
project (not bundled — ask if needed).

---

## Screens / Views (Desktop)

All desktop screens share a **sticky header** (64px tall, navy `rgba(10,27,61,0.97)`
with `backdrop-filter: blur(12px)`, 3px gold bottom border): logo (home link) · right
group = device toggle · Help link · cart bag (with gold count badge) · gold
"Find my finish" pill button.

### 1. Home
- **Purpose:** Pitch + entry into the flow.
- **Layout:** Full-bleed navy **hero** with speed lines; centered `max-width:1180px`
  content, two-column grid `1fr 430px`. Left = eyebrow, huge H1 "OWN YOUR FINISH LINE."
  (gold "line."), sub-paragraph, primary gold CTA "Find my finish →". Right column = a
  finish-photo showcase card.
- Below hero: **"How it works"** 3-step section (numbered `01 / 02 / 03`), a
  **recent meets** row, and supporting sections.
- **Copy — 3 steps:**
  1. *Find your meet* — "Search across every meet we shot, or jump in from a recent one."
  2. *Search your name* — "Every finish-line frame of your race, with your official time attached."
  3. *Style it & post* — "Pick a format and overlay, copy the caption, and it's feed-ready."

### 2. Meets index
- **Purpose:** Browse/select all meets.
- **Layout:** Navy banner header, then a responsive grid of **meet cards** (photo
  thumbnail, meet name 800 italic, date, venue). Clicking a card → Meet search.
- **Meet data (6):** USATF JO New England Association (Jun 12, 2026 · Whitman, MA);
  Rhode Island State Championships (Jun 6 · Brown University); New England Outdoor
  Championships (May 31 · Thornton, NH); Cranston Twilight Invitational (May 22 ·
  Cranston Stadium); Eastern Spring Classic (May 9 · Boston, MA); Ocean State Relays
  (Apr 25 · Providence, RI).

### 3. Meet search
- **Purpose:** Find your finish within a meet (by name / event / heat).
- **Layout:** Navy meet banner (meet name/date/venue), a search input + filter chips
  (segmented controls / chips for event, round, heat), then a **results list** of
  athlete rows that animate in with a stagger. Each row: place badge, athlete name +
  team, event · heat, tabular finish time, thumbnail, chevron.
- **Athlete data (sample):** e.g. *Colby Flynn — Hendricken — Boys 3000 Meter Run —
  8:45.06 — 1st — "Personal best"*; relay entries carry team-only names (e.g.
  *Cumberland — Boys 4x400 Relay — 3:28.41 — 1st*).

### 4. Athlete photo page  ← the core screen
- **Purpose:** View your finish frame(s), pick a bundle, style a social graphic, add to cart.
- **Layout:** Navy athlete banner (name, team, event · heat, place, time badge). Below,
  a two-panel working area:
  - **Left / main:** the finish photo (watermarked), a **film-strip** of race frames
    (single frame / overlay / full-race thumbnails), and a draggable **focal-point**
    crop control.
  - **Right / rail:** bundle selector, format toggle (**Post** / **Story**), overlay
    template picker (**White & gold / Result bar / Big time**), tag selector (None /
    Personal Best / Season Best), a **live preview** (`FinishPreview` component), the
    generated **caption + hashtags** with a copy button, price, and **Add to cart**.
- **Bundles & pricing (from prototype):**
  - `raw` — "Hi-res photo, no overlay"
  - `photosocial` — "Raw + formatted finish image" (default selection)
  - `works` — "Photo + formatted + post & story"
  - `social` — "One post + one story, no photo file"
  - Social add-on upsell: "Unlock with Full · $15".
- **Formats:** `feed` = square Post (1080×1080); `story` = 9:16 Story (1080×1920).
- **Overlay templates:** `whitegold`, `bar` (result bar), `bigtime`. (The `FinishPreview`
  component additionally supports `minimal`, `strava`.)
- On **Add to cart**: a toast appears ("Added to cart") with "Keep browsing" / "View cart"
  actions; the header cart badge increments. Re-opening a photo already in the cart
  loads its saved styling back into the editor for editing.

### 5. Cart
- **Purpose:** Review line items, edit or remove, proceed to checkout.
- **Layout:** Navy banner, list of cart lines (thumbnail, athlete/meet, bundle name,
  configured socials, price, edit/remove), order summary with total, "Checkout" CTA.

### 6. Checkout
- **Purpose:** Enter email, pay.
- **Layout:** Navy banner, email field (validated `/.+@.+\..+/`), order summary,
  **"Pay $<total>"** button. On submit → 1.1s "placing" spinner state → Confirmation.
- Order number format: `FP-####`.

### 7. Order confirmation / downloads
- **Purpose:** Success + deliver files.
- **Layout:** Navy gradient hero with success state, order number/email/date, and
  **download cards** grouped per purchased item. Each generates a **real image** via
  canvas (clean hi-res photo, and/or the styled Post/Story graphic matching the
  on-page preview exactly). On mobile-capable devices it offers native **share-sheet**
  (image file) via `navigator.canShare`; otherwise falls back to file **download**.

### 8. Mobile rendering
- The Mobile toggle renders the **same flow** inside an iPhone frame on a light
  (`#EDF0F5`) stage: home, meet search, photo page (stacked, with the preview and
  caption below the photo), cart, checkout, confirmation. Touch targets ≥44px;
  horizontally scrollable chip rows for filters/templates.

---

## The `FinishPreview` component (shared child)
`FinishPreview.dc.html` renders the **live social-graphic preview** and is reused on
the photo page (desktop + mobile). Recreate it as a single reusable component.

**Props:**
- `a` — the athlete/result object (name, team, event, time, place, img, badge)
- `meet` — meet object (name, date, venue)
- `format` — `"feed"` | `"story"` | `"strava"` (default `feed`)
- `tpl` — overlay template: `"whitegold"` | `"bar"` | `"bigtime"` | `"minimal"` | `"strava"` (default `whitegold`)
- `posX`, `posY` — focal point 0–100 (%) for background-cover crop; `onPos(x,y)` callback
- `compact` — boolean, tighter layout
- `watermark` — boolean, overlay the SAMPLE watermark

**Behavior:** the photo is `background-size: cover` positioned by `posX%/posY%`; the
user **drags** on the image to reposition the focal point (pointer events update
`onPos`). Overlay templates lay out name / team / big gold time / event · meet · venue
credit line. The **downloaded/shared image is a canvas render that pixel-matches this
preview** (same aspect ratio, template, tag, crop) — see `_composeImage`,
`_renderGraphic`, `_renderCard` in `Photo Page v2.dc.html`.

---

## Interactions & Behavior (summary)
- **Navigation** is single-page/screen-state driven (`home → meets → search → photo →
  cart → checkout → confirm`) with a fade/lift page transition and scroll-to-top on each
  change. In production, map these to real routes.
- **Device toggle** switches desktop/mobile renderings (prototype convenience; in
  production this is just responsive CSS).
- **Cart:** add / update / remove line items; header badge reflects count; editing a
  cart line rehydrates the photo editor.
- **Styling the graphic:** format toggle, template picker, tag picker, and draggable
  focal crop all update the live preview instantly.
- **Caption:** auto-generated caption + hashtags with one-tap **copy** (shows "Copied").
- **Checkout:** email validation; async "placing" spinner (~1.1s) before confirmation.
- **Downloads:** canvas-generated JPEGs (quality 0.92); native share on capable devices,
  download otherwise; toast feedback.
- **Watermark** on all pre-purchase finish photos; removed in the purchased/downloaded output.
- Accessibility: honor `prefers-reduced-motion`; keep tabular numerals for times/prices;
  hit targets ≥44px on mobile.

## State (variables to model)
`viewMode` (desktop/mobile), `screen`, `query` / `meetQuery`, `selId` (selected athlete),
`activeMeet`, `format`, `tpl` (template), `bundle`, `tag`, `focal {x,y}`, `cart[]`,
`draftSocials[]`, `editingLineId`, `justAdded`, `toast`, `email`, `emailValid`,
`placing`, `lastOrder`, `canShareFiles`, `shareStatus{}`. In production, replace with
real product/meet/results data fetching and a cart store.

## Data (currently hardcoded — replace with API/CMS)
Meets, athletes/results, recent meets, bundle definitions & prices, and the "how it
works" steps are all hardcoded arrays in the logic class of `Photo Page v2.dc.html`
(`MEETS`, `ATHLETES`, `RECENT`, `STEPS`, bundle maps). Use them as the data shape
reference; wire to your real meet-results/imagery backend.

## Assets
- `assets/pf-*.jpg`, `assets/photo-finish.jpg` — sample photo-finish images used for
  meets/athletes.
- `uploads/38-1-1-*.jpg` — relay finish photos referenced by the 4×400 athlete rows.
- All imagery in production comes from the photo-finish camera system per meet/heat.
  These bundled files are placeholders/samples only.

## Files in this bundle
- **`Photo Page v2.dc.html`** — the primary, complete prototype (all screens, desktop +
  mobile, all logic). **Start here.**
- **`FinishPreview.dc.html`** — the shared social-graphic preview component (child).
- `support.js` — the prototype runtime (needed only to open the HTML; **do not port**).
- `_ds/…/tokens/*.css` — FinishLynx design-system token CSS (spacing/type scale useful;
  see the palette note — FinishPics uses navy/gold/blue, not the tokens' purple).
- `assets/`, `uploads/` — sample images.

### Related files in the parent project (not bundled — ask if you want them)
- `Photo Page.dc.html` — earlier version of the flow.
- `Mobile Viewer.dc.html` — standalone mobile-only rendering.
- `Home Layout Explorations.dc.html` — alternative home layouts.
- `Logo Explorations.dc.html` — logo/wordmark directions.
- `Trailer Flyers.dc.html` — printable QR flyers (for signage at meets).
