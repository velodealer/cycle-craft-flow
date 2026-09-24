# Fix duplicated family name in bike model

## Problem
When a 99spokes record is applied to a bike, the model is built as `family + " " + model`. For BPS-CAN-0032, 99spokes reports family "Aeroad" and model "Aeroad CF SL 8", so the saved model became "Aeroad Aeroad CF SL 8".

## Fix
1. In `src/lib/spokes.ts` (`mapSpokesBike`), only prepend the family when the model does not already start with it (case-insensitive). If the model is empty, fall back to the family alone. This matches the de-duplication style already used for part names.
2. Correct the already-saved row: set BPS-CAN-0032's model to "Aeroad CF SL 8" (one-line data update).
3. Check other bikes with 99spokes data for the same duplication and fix any found in the same update.

## Technical details
- Change is in `bikeFields.model = [bike?.family, bike?.model]...` — becomes a family-prefix check before joining.
- Data fix via a small SQL update scoped to bikes whose model starts with the family repeated twice (e.g. `model ilike family || ' ' || family || ' %'`), reviewed before running.
- No schema changes, no RLS changes, no migration files.
