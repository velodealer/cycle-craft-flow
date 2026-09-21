# Full activity history for every bike

Today the "Stage History" panel only shows five workshop stages (intake, cleaning, inspection, repair, ready). Anything else — a price change, an eBay listing, a sale, a photo upload — is never recorded, which is why BPS-TRE-027T looks empty.

This replaces it with a proper Activity timeline that records everything that happens to a bike, from now on.

## What gets recorded

- Status changes (every status, not just the five workshop stages), including sale reversals
- Price edits: purchase, asking and sale price, showing the old and new figure
- Marketplace activity: listed, relisted, price/stock updated, ended or delisted on eBay and Shopify, including failures with the reason
- Sale completed, invoice raised, invoice paid, part-exchange taken
- Photos added, bike details edited (make, model, spec, condition, description)
- Jobs created, started and completed, with cost
- Parts added or removed, other costs added
- Inspections started and completed, faults approved or declined
- Collections and deliveries booked, and each courier status update
- Storage bay assigned or changed
- Bike created and (where applicable) split for parts

## What it looks like

On the bike page, "Stage History" becomes "Activity". A single reverse-chronological list: time, who did it (or the system / eBay / courier for automatic entries), a plain-English line such as "Asking price changed from £1,450 to £1,295", and any note or detail underneath. Small filter chips let you narrow to Status, Money, Listings, Workshop or Logistics. Long histories collapse behind a "Show all" button.

Visibility follows the existing rules: mechanics don't see money entries, investors see only their own bikes' entries.

Only activity from the moment this ships appears; existing bikes start with an empty timeline plus their old stage entries.

## Technical notes

- New table `public.bike_activity`: `bike_id`, `business_id`, `kind` (text, e.g. `status_change`, `price_change`, `listing`, `sale`, `job`, `part`, `cost`, `inspection`, `logistics`, `photo`, `detail_change`, `storage`), `action` (short code), `summary` (rendered text), `detail` jsonb (old/new values, ids, error text), `actor_id` (nullable profile id), `actor_label` (for system/integration entries), `created_at`. Indexed on `(bike_id, created_at desc)`. Tenant-scoped RLS matching `bikes` (read for business members, insert for authenticated members, no update/delete), plus `GRANT`s for `authenticated` and `service_role`.
- Client helper `src/lib/activity.ts` with `logActivity(bikeId, entry)` — fire-and-forget, never blocks the action it records. Called from the existing write paths: `AdminStatusSelect`, `AdvanceStageDialog`, `BikeDetailView` (price and detail edits, photos), job/part/cost forms, sale and invoice flows, storage bay change.
- Edge-function helper `supabase/functions/_shared/activity.ts` using the service-role client, called from `ebay-sync-bike`, `shopify-sync-bike`, `reverse-sale`, the QuickBooks sale/invoice paths, the Cycle Courier webhook and the InspectABike webhook, so automatic events are attributed to the integration.
- `StageHistory.tsx` becomes `BikeActivity.tsx`: reads `bike_activity` and merges the legacy `fulfilment_events` rows so nothing already recorded is lost; filter chips map to `kind`; money kinds hidden when the viewer can't see pricing.
- `delete-bike` also clears `bike_activity` rows.

## Separate issue spotted

BPS-TRE-027T's last eBay attempt failed: eBay rejected the description as over its 4,000-character limit (your saved eBay listing format renders longer than that). Not part of this change — say the word and I'll plan a fix to trim or tighten the description before sending.
