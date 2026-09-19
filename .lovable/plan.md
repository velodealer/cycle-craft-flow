# Show the real dealership and staff name on InspectABike

Right now an inspection sent to InspectABike shows "Cycle Craft Flow" as the customer whenever the bike has no named owner. That is a leftover placeholder. It should show your dealership name and the person who started the inspection.

## What changes

- When the bike has a named owner (consignment), the customer stays that person's name, as today.
- Otherwise the customer becomes the dealership name plus the staff member who started it, e.g. `Broximo Prestige Steeds (Jahan Khan)`.
- Approving or declining a fault is also currently sent as "Cycle Craft Flow"; it will be sent as the staff member's name with the dealership, so InspectABike shows who made the decision.

## Technical detail

`supabase/functions/inspectabike-create/index.ts`
- Look up `businesses.name` for the bike's `business_id` and use the authenticated caller's `profiles.name` (already loaded by `requireRole`).
- `customer_name` = external owner name when `external_owner_id` is set; otherwise `"<business name> (<staff name>)"`, falling back to the business name alone if the profile has no name, and to `"VeloDealer"` only if neither lookup returns anything.

`supabase/functions/inspectabike-decision/index.ts`
- Replace the hardcoded `actor_name: 'Cycle Craft Flow'` with `"<staff name> — <business name>"` from the caller's profile and business.

Both functions redeploy; no database or UI changes. Existing inspections keep whatever name they were created with.
