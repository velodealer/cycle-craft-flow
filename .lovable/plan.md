# Remove dealer-facing setup wording (Typeform + InspectABike report links)

## Changes

1. **Typeform card** (`src/components/settings/TypeformIntegration.tsx`, ~line 305): remove the "Create a Typeform app at developer.typeform.com and add this OAuth redirect URI…" block entirely. Dealers just click Connect.

2. **InspectABike backfill card** (`src/components/settings/InspectABikeBackfill.tsx`): remove the whole "Report link address" section (explanatory text, input, "Save & fix links" button, and its load/save/fix-links logic). The "Backfill from InspectABike" button and description stay.

3. **Report links come straight from InspectABike**: remove the link-rewriting behind the scenes so every report link is stored exactly as InspectABike sends it (via webhook, create, sync, backfill):
   - Delete `rewriteReportUrl` and `getReportBaseUrl` from `supabase/functions/_shared/inspectabike.ts`.
   - Update the call sites that pass the base URL through (`inspectabike-create`, `inspectabike-sync`, `inspectabike-webhook`, `inspectabike-backfill`) to store the report URL as received.
   - Redeploy those four functions.

Existing saved links stay as they are; new/updated links will use whatever address InspectABike sends.

## Result

Settings no longer shows any developer setup wording — Typeform shows only the Connect flow, and InspectABike shows only the backfill tool.
