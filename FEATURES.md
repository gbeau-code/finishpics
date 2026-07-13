# FinishPics — Feature Requests

## Implemented on the v2 branch (pending cutover)

### Smart meet cleanup ✅ (v2 branch, 2026-07-12)
`cleanupOldMeets` in `web/lib/database.ts` now deletes only unpurchased athlete
images/rows; athletes with a paid legacy purchase OR a paid v2 order item are kept
forever. Heats/meets are removed once empty; meets with kept purchases are
"trimmed" instead of deleted. Admin UI confirm dialog + result text updated.

## Pending

### Tier upgrade / proration
Today each purchase is independent: someone who buys basic ($5) then wants full ($15) pays $20 total, because access is gated per Stripe session token with no upgrade path. Build a proper upgrade flow.
- On the photo page, detect that the visitor already has a confirmed purchase for this athlete (lower tier)
- Offer "Upgrade to Full — $10" charging only the price difference
- After payment, their access should reflect the new (higher) tier
- Decide how access carries: either reuse/upgrade the existing purchase row's tier, or issue a new token that supersedes the old one
- Interim workaround (current): refund the lower purchase in the Stripe Dashboard (Payments → select payment → Refund) and have them rebuy the higher tier. Note: a dashboard refund does NOT update the DB — the old session link still unlocks the image and the admin revenue report still counts it. Acceptable for rare one-offs.
- Needs: photo page purchase detection, checkout route that computes the delta, webhook/confirm logic to bump the stored tier
