# InspectABike integration for the inspection step

Send a bike for inspection with one button, let the mechanic work in InspectABike, and get faults back automatically with parts and labour prices for approval — feeding straight into the bike's costs.

## What you will see

1. **Send to InspectABike** button on a bike in the inspection stage (and on the Inspection queue page). It creates the inspection over there and saves the link back.
2. The **Inspection section** shows the report link, the inspector's name, the overall grade (1-5) and the stolen-check result once available, plus a **Refresh** button to pull the latest.
3. The mechanic completes the inspection on that link. Faults arrive here automatically as they are raised.
4. Any fault puts the bike into **Awaiting approval** with a **Faults** panel listing each fault, its parts cost and labour cost. If the inspection finishes with no faults, the bike moves to **Ready for sale** on its own.
5. Admin and owner can **Approve** or **Decline** each fault (with an optional note). The decision is sent back to InspectABike. Mechanics see the list read-only.
6. Approved faults become real costs on the bike — parts cost and labour cost — so they roll into the existing cost total, stand-in value and margin figures on the finance side. Declined faults cost nothing.
7. Once every fault is repaired or declined, the bike is released from Awaiting approval to Ready for sale.

## Technical detail

**Secrets**: `INSPECTABIKE_API_KEY`, `INSPECTABIKE_WEBHOOK_SECRET` (the second must match the value entered in InspectABike). Base URL `https://gotuhdjrkxtwwcezgbjo.supabase.co/functions/v1`, auth header `x-api-key`.

**Database**
- `inspections`: add `external_inspection_id`, `external_reference`, `overall_grade`, `inspector_name`, `stolen_status`, `synced_at`. `report_url` holds the InspectABike link.
- New `inspection_faults`: `id`, `inspection_id`, `bike_id`, `external_fault_id` (unique), `title`, `description`, `component`, `severity`, `parts_cost`, `labour_cost`, `status` (`reported` | `approved` | `declined` | `awaiting_part` | `repaired`), `decision_note`, `decided_by`, `decided_at`, `part_id`, `job_id`, `raw` jsonb, timestamps. Grants for `authenticated` and `service_role`; RLS: staff read, admin/owner update, webhook writes via service role.

**Edge functions**
- `inspectabike-create` — JWT validated in code, admin/mechanic only. Uses the bike reference as `reference` (idempotent), posts `serial_number` (frame number), `bike_make`, `bike_model`, `bike_type` (mapped from the bike's type/electric/carbon fields to `standard|carbon|ebike|mountain`), `bike_year`, `customer_name`, `notes`. Stores `inspection_id` and `report_url` on the inspection row, creating it if absent.
- `inspectabike-sync` — calls `GET /partner-inspection?id=` and refreshes grade, inspector, stolen status, documents and the full fault list.
- `inspectabike-webhook` — `verify_jwt = false`. Verifies `x-inspectabike-signature` as hex HMAC-SHA256 of the raw body keyed with the webhook secret before parsing, returns 200 immediately, then upserts the fault by `external_inspection_id` + fault id for `fault.created` / `fault.updated` / `fault.repaired`, and removes it on `fault.deleted`. Recomputes bike status: any open fault means `pending_approval`; all repaired or declined means `ready`.
- `inspectabike-decision` — admin/owner only; posts `{ fault_id, decision, note, actor_name: "Cycle Craft Flow" }` to `/partner-fault-decision` and mirrors the status locally. Costs are never sent — InspectABike owns pricing.

**UI**
- Rework `src/components/bike/InspectionTask.tsx`: replace the manual inspectabike.com link and manual "issues found" checkbox with the send/refresh actions, grade and stolen-check summary, and the report link.
- New `src/components/bike/InspectionFaults.tsx` for the fault list, costs, approve/decline. Shown on the bike page and inside the inspection dialog.
- Approving a fault writes a `parts` row (parts cost) and a `jobs` row with `actual_cost` (labour cost) linked to the bike, so `BikeCostsSection` totals pick them up with no change to the finance maths.
- The Inspection queue page gets a per-bike Send button and shows fault counts.

**Errors**: 400 validation, 401 bad key, 404 not found, 500 server — each surfaced as a plain message in the UI with a retry.
