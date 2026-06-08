# TimingPics Web Platform

A Next.js 14 app where athletes and parents find and purchase their photo-finish timing images from track and field meets.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in:

**Supabase:**
- Create a project at [supabase.com](https://supabase.com)
- Copy **Project URL** and **anon/public key** from Settings > API into `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Copy the **service_role** key into `SUPABASE_SERVICE_ROLE_KEY` (keep this secret — server-side only)

**Supabase Storage:**
- Go to Storage in your Supabase dashboard
- Create a bucket named exactly `heat-images`
- Set it to **Private** (no public access — the app uses signed/admin downloads)

**Database:**
- Open the SQL Editor in Supabase
- Paste the contents of `lib/schema.sql` and run it

**Stripe:**
- Get test keys from [dashboard.stripe.com](https://dashboard.stripe.com) > Developers > API keys
- `STRIPE_SECRET_KEY` = secret key (starts with `sk_test_`)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = publishable key (starts with `pk_test_`)

**Stripe webhook (local dev):**
1. Install the [Stripe CLI](https://stripe.com/docs/stripe-cli)
2. Run: `stripe listen --forward-to localhost:3000/api/webhook`
3. Copy the webhook signing secret (starts with `whsec_`) into `STRIPE_WEBHOOK_SECRET`

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing the upload

With the Python agent's `test_upload.py`, set:
- `api_url = "http://localhost:3000"`
- `api_key = "dev-secret-key-change-me"`

Then run `python test_upload.py` to upload a test heat image.

After uploading, go to [http://localhost:3000](http://localhost:3000) and search for **"Smith"** (or whatever last name was in the test data).

## How it works

1. **Python agent** uploads photo-finish images + athlete metadata via `POST /api/upload` (authenticated with `X-API-Key`)
2. Images stored in Supabase Storage (`heat-images` bucket)
3. Athletes/meets/heats recorded in Supabase Postgres
4. Users search by name or bib number at `/`
5. `/photo/{athleteId}` shows a watermarked preview
6. Clicking "Purchase" → Stripe Checkout (~$7)
7. Stripe webhook (`/api/webhook`) records the paid order in the `orders` table
8. Success page at `/success?session_id=...` provides the download link
9. `/api/download/{athleteId}?session_id=...` verifies payment and serves the full unwatermarked image

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/upload` | `X-API-Key` header | Upload heat image + athlete metadata |
| GET | `/api/search?q=...` | None | Search athletes by name or bib |
| GET | `/api/preview/{athleteId}` | None | Watermarked JPEG preview |
| POST | `/api/checkout` | None | Create Stripe checkout session |
| POST | `/api/webhook` | Stripe signature | Record completed payments |
| GET | `/api/download/{athleteId}?session_id=...` | Paid order | Download full image |
| GET | `/api/meets` | None | List recent meets |

## Deployment

Deploy to [Vercel](https://vercel.com) (recommended):

```bash
npx vercel
```

Set all environment variables in the Vercel dashboard. Update `NEXT_PUBLIC_APP_URL` to your production domain. Update the Stripe webhook endpoint in the Stripe dashboard to point to `https://your-domain.com/api/webhook`.
