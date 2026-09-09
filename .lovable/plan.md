# Send bikes to Bike Checker Pro for inspection

One button on a bike sends it to Bike Checker Pro, the mechanic inspects it there, and the findings come back automatically as a costed job list awaiting approval.

## A note on the connection

I can see Bike Checker Pro in your workspace, but I cannot read or change its code from here — the two apps are separate projects with separate databases. So this plan builds the whole VeloDealer side plus the two small endpoints Bike Checker Pro must call and be called on. Once this is approved, the matching piece in Bike Checker Pro is a short follow-up job done in that project, using exactly the contract below.

## What you will see

1. **Send for inspection** button on any bike in the inspection stage (and a bulk version on the Inspection page). It creates the inspection over in Bike Checker Pro and stores the returned link.
2. The **Inspection section** shows the live link, so the mechanic taps straight through to the checklist on their phone.
3. The mechanic completes the inspection in Bike Checker Pro:
   - No faults: the bike moves to **Ready for sale** by itself.
   - Faults found: the bike moves to **Awaiting approval** and the findings arrive as a list of proposed parts and labour, each with a price.
4. On the bike page, a **Proposed work** panel lists each item with its cost. Admin and owner can approve or reject items (all at once or line by line). Mechanics see it read-only.
5. Approved items become real parts and labour on the bike, so they flow into the existing cost total, stand-in value and margin on the finance side. Rejected items are kept for the record but cost nothing.

## Technical detail

**New data**
- `inspections`: add `external_id`, `external_status`, `provider` (default `bike_checker_pro`), `synced_at`. `report_url` continues to hold the mechanic's link.
- New `inspection_findings`: `inspection_id`, `bike_id`, `external_item_id`, `kind` (`part` | `labour`), `title`, `description`, `severity`, `quantity`, `unit_cost`, `labour_hours`, `labour_rate`, `total_cost`, `status` (`proposed` | `approved` | `rejected`), `approved_by`, `approved_at`, `part_id`, `job_id`, timestamps. Grants for `authenticated` and `service_role`, RLS: staff read; only admin/owner update status; writes from the webhook use the service role.

**Outbound: create inspection**
- Edge function `bike-checker-create-inspection` (JWT validated in code, admin/mechanic only). Posts bike reference, make/model/year, size, colour, frame number, photos and the callback URL to Bike Checker Pro, stores `external_id` and `report_url` on the inspection row, creating the inspection row if absent. Handles retry and surfaces failures in the UI.

**Inbound: results**
- Edge function `bike-checker-webhook` with `verify_jwt = false`, HMAC SHA-256 signature check against a shared secret (same pattern as the Cycle Courier Co webhook). Accepts a completion payload, upserts findings by `external_item_id` (idempotent), marks the inspection completed, sets `has_issues`, and moves the bike to `ready` or `pending_approval`.

**Contract Bike Checker Pro must satisfy**
- `POST /inspections` → `{ id, url }`, authenticated by an API key VeloDealer holds.
- On completion, `POST` to the VeloDealer webhook URL with `{ inspection_id, external_id, status, has_issues, report_url, notes, items: [{ id, kind, title, description, severity, quantity, unit_cost, labour_hours, labour_rate }] }` plus the HMAC signature header.

**Secrets to add**: `BIKE_CHECKER_API_URL`, `BIKE_CHECKER_API_KEY`, `BIKE_CHECKER_WEBHOOK_SECRET`. A default labour rate goes in `app_settings` for items sent as hours only.

**Approval**
- Component `InspectionFindings.tsx` on the bike page. Approving a part inserts into `parts` linked to the bike; approving labour creates a `jobs` row with `actual_cost`, so `BikeCostsSection` totals pick both up with no change to the finance maths. Once no proposed items remain, the bike can be advanced out of Awaiting approval as it is today.
