# Point InspectABike calls at api.inspectabike.com

All InspectABike requests currently go to the old supabase.co address. There is a single place where that address is set, so this is a small change.

## What changes

- Calls go to `https://api.inspectabike.com/functions/v1` instead of the supabase.co address. This affects creating an inspection, fetching an inspection, approving or declining a fault, undoing a decision, syncing, and the retrospective backfill — they all share the same setting.
- The address becomes overridable by a stored setting, so it can be changed in future without a code change; if nothing is set, the new api.inspectabike.com address is used.
- Nothing about the security check on incoming InspectABike messages changes, and the links to inspection reports (inspectabike.com/bike/report/...) stay as they are.

## Checks

The new address was already confirmed reachable: a request without credentials returns "not authorised", which is the expected reply from a live endpoint.

After the change: run the sync on a bike that already has an inspection and confirm faults still come back without errors.

## Technical notes

- `supabase/functions/_shared/inspectabike.ts`: `INSPECTABIKE_BASE_URL` becomes `Deno.env.get('INSPECTABIKE_BASE_URL') || 'https://api.inspectabike.com/functions/v1'` (trailing slash trimmed).
- Redeploy the functions that import it: `inspectabike-create`, `inspectabike-sync`, `inspectabike-decision`, `inspectabike-undo-decision`, `inspectabike-backfill`, `inspectabike-webhook`.
