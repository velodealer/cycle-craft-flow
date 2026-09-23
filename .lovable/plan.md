# Silent-error sweep, then Checkpoint 1 (additive schema and a single resolver)

There's one stop at the end for review. Automatic listing (AUTO_LIST_PAUSED) stays paused throughout.

## Part A: Finish the silent-error class (code only, no schema)

1. **Shopify** (`_shared/shopify-listing.ts`)
   - Check the error on the bike loads at lines 94 and 166.
   - Check the error on the existing-listing reads at lines 215, 291 and 311.
   - A failed "does it already exist?" read throws. It is never treated as "not listed", so a second product can't be created.
2. **Squarespace** (`_shared/squarespace-listing.ts:38`): same treatment.
3. **Full sweep** of every publish, sync and pricing path in `src/` and `supabase/functions/`, looking for:
   - empty `catch {}`
   - `.catch(() => [] | null | undefined)`
   - destructured `{ data }` where the error is never checked
   - `data ?? []` after a query whose error wasn't checked

   Each hit is either fixed, or named as a deliberate ignore with a one-line verdict. For example, the promoted-listing bid update stays deliberate. Non-publish UI reads are listed but left alone.
4. **Regression tests** (`_shared/*_test.ts`):
   - eBay, Shopify and Squarespace: when the existing-listing read fails, the push throws and no create call is made.
   - The fake client counts create calls and the test asserts zero.
5. Redeploy the affected functions through the normal deploy. Report the sweep list.

## Part B: Checkpoint 1 (additive and reversible)

**Migration (up)**
- `bike_components`: add `brand`, `model`, `mpn` (all text, nullable), `attributes` (jsonb, nullable) and `spec_overrides` (jsonb, nullable). These are per-bike overrides and are null by default.
- `components`: add `source` (text, nullable), `raw_text` (text, nullable) and `confidence` (numeric, nullable).
- New table `slot_categories`:
  - Columns: `slot` (primary key), `category_slug`, `position`, `label`, `sort_order`.
  - Seeded from the slots in `bikeSpec.ts`, including the mismatches: wheelset → wheels, disc_rotors → rotors, front_tyre/rear_tyre → tyres, front_hub/rear_hub → hubs, and accessory slots → accessories.
  - The seed rows are written in the migration as reference data. No user data is changed.
  - Grants: select for authenticated, all for service_role.
  - RLS is on, with a single read policy for signed-in users. This is a new table's own access rule; no existing rule is changed.
- updated_at trigger on `components`: it already exists (`update_components_updated_at`), so nothing needs adding. The migration will confirm this and add nothing.

**Down migration**
- `docs/rollback-checkpoint-1.sql` drops the new columns and the `slot_categories` table, in one transaction.

**Untouched:** existing access rules, unique keys, slot values (no enum) and existing data.

**Single resolver**
- New `_shared/fitted-part.ts` exports `resolvePart(row)`, which works in both the browser and the edge functions. For each field it returns override → library value:
  - brand, model, mpn and description
  - attributes, merged so override keys win
  - the category, taken from `slot_categories`
- `fetchBikeComponents` selects the new override columns and returns resolved parts. Every reader goes through this one function:
  - both template renderers
  - the bike page specification rows
  - eBay aspects
  - Shopify and Squarespace field mapping
- A grep check confirms no reader still falls back inline from `bc.x` to `components.x`.
- Nothing fills the overrides yet, so the rendered output must match the before snapshot on all 142 tokens. I'll check this by re-rendering BPS-TRE-027T with the existing read-only query tool: pull the raw rows, then run both renderers locally. No temporary functions.

Stop for review.

## Queued after Checkpoint 1 (not built now)

- **BrandMPN:**
  - Pull `getItemAspectsForCategory` for category 177831 through the existing eBay connection and show exactly what it requires and recommends for Brand, MPN and the brand/MPN pairing on used items.
  - Compare it against what we send and list every missing or wrong aspect, then propose one combined fix. No "Does Not Apply" change until this is confirmed.
- **Checkpoint 2 scope note:** `bikes.mpn` is empty on every bike. 99spokes often carries the manufacturer's model code, so filling it from there goes into Checkpoint 2.

## Temporary function: confirmation

`tmp-render-snapshot` was deleted through the deploy tool and its folder removed from the project. It only read data and created no database objects, keys or secrets. The one-off token existed only inside the deleted code. Nothing it created still has access.

Rule going forward: no ad-hoc functions with live database access. Verification uses read-only queries, or I ask first.
