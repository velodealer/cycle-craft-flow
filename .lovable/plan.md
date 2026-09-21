# Pull part numbers and spec details out of catalogue text

## What 99spokes actually sends

For that rear derailleur the catalogue gives only four fields:

```text
maker:       Shimano
model:       105 Di2
display:     Shimano 105 Di2
description: Shimano R7150 Di2, 36T max cog
```

So the model shown ("105 Di2") is correct — it is exactly what 99spokes calls the model. "R7150" and "36T max cog" are not separate fields anywhere in the catalogue; they only exist inside that one sentence. Across every bike we hold, the only structured part fields the catalogue ever uses are: maker, model, display, description, material, width, innerWidthMM, standard, kind, threaded.

## What to change

Read the useful details out of that sentence when a part comes in, and store them in their own fields so they show as proper rows instead of a blob of text:

- Part number (e.g. R7150, RD-R8150, GX Eagle codes) — goes into the part's Part number field, which is currently empty for almost everything
- Max cog (36T), gear range (11-34), number of speeds (12 speed)
- Chainring sizes (50/34), crank length (172.5mm), rotor sizes (160mm), tyre size and width, travel (140mm), bar width, stem length, seatpost diameter

Each is only filled when it is clearly present; anything we cannot read confidently stays in the description, which we keep as-is. Values you have typed yourself are never overwritten — only blanks get filled.

These appear on the part in the library, under the fitted part on a bike's specification tab, and as tokens in the listing template builder.

## Applying it to existing parts

A one-off pass re-reads the descriptions already stored on parts and fills in the new fields where they are blank, so the library benefits without re-importing every bike.

## Technical notes

- `src/lib/spokes.ts`: add `parseSpecFromText(text)` returning a typed attribute object; call it in `push()`, merging the derived values under the part's `attributes` (and setting `mpn` when a part number is detected and none was supplied). Front/rear split via `splitFrontRear` runs first so each side parses its own text.
- Mirror the same helper in `supabase/functions/_shared/` only if a function needs it; currently parsing happens client-side at import time, so no edge function change.
- `ComponentAttributes.tsx` already humanises keys, so new keys (`part_number`, `max_cog`, `speeds`, `gear_range`, `chainring`, `crank_length_mm`, `rotor_size_mm`, `travel_mm`, `tyre_width_mm`, `bar_width_mm`, `stem_length_mm`, `seatpost_diameter_mm`) render without UI work.
- Backfill: a `run_sql`-driven update is not possible (parsing is JS), so add a small "Re-scan details" action on the parts page for admins that re-parses stored descriptions in batches.
- No schema change — `components.attributes` and `components.mpn` already exist.

## Still to build

The approved Customer Service role (enum value, policy updates, sidebar and user dialogs, pricing-without-costs on the bike page) has not been implemented yet and will be built as approved.
