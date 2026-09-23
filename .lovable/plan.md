# Fitted parts: verify, back up, restructure additively, re-parse (dry runs)

This work runs in five stages. I stop after each one and wait for your review. Nothing is bulk-imported. Stages 3 and 4 are read-only.

## Checkpoint 0: Verify and back up
- 0.1 Look up BPS-TRE-027T and list every `bike_components` row with its exact `slot` string, plus the linked component's brand, model and mpn.
- 0.2 Render the bike's saved eBay template through both renderers. The browser one (`src/lib/listingTemplate.ts`) runs via bun. The server one (`_shared/listing-template.ts`) runs via deno, using the same data that `loadBikeComponents` fetches. Show every `part_*` token side by side.
- 0.3 Find out why the nine tokens came out empty. I will check each possible cause against evidence:
  - slot strings compared with token names
  - what `loadBikeComponents` returns under the service role compared with under a user's session
  - the embedded select: `components(name, …)` asks for a `name` column, which may not exist and could make the whole query fail quietly to `[]`
  - when the listing was published compared with when the parts were linked (`bike_activity`, `ebay_listings.last_synced_at`)
  - whether the eBay path renders from the offer description or from somewhere else
  
  I will report only the cause the evidence supports.
- 0.4 One migration creates these backup tables (dated `YYYYMMDD`):
  - `components_backup_<date>`: full copy
  - `bike_components_backup_<date>`: full copy
  - `bikes_spec_backup_<date>`: `id`, `spec_values`, `accessories_included`

  Access is limited to the service role and the super admin. I will also write `docs/restore-fitted-parts.sql` with documented steps to restore these tables, and confirm the row counts match.

## Checkpoint 1: Schema changes (additive and reversible)
- `bike_components` gains optional `brand`, `model`, `mpn`, `attributes jsonb default '{}'` and `spec_overrides jsonb default '{}'`. When set, these override the library values.
- `components` gains `source`, `raw_text` and `confidence`. `source` accepts '99spokes', 'manual' or 'import'; `confidence` accepts 'confirmed' or 'unverified'. Both are checked by validation triggers, not CHECK constraints.
- A new `slot_categories` table (`slot` is the key, `category_slug` references `component_categories.slug`), seeded from `bikeSpec.ts` including the mismatches you listed. It gets grants, RLS with read access for signed-in users, and super-admin write access.
- An `updated_at` trigger on `components`.
- A down migration shipped as `docs/rollback-checkpoint1.sql`.
- No changes to existing access rules, unique keys or slot types.

## Checkpoint 2: Parser (code only)
- New pure module `src/lib/partParser.ts`, with `spokes.ts` using it:
  - UTF-8 normalisation and mojibake repair
  - brand lookup from your dictionary, with the bike's make as a fallback
  - fragment blacklist
  - part-number extraction, plus inferred Shimano prefixes (always marked unverified)
  - drivetrain, wheel and tyre values, resolved against the bike's size
  - gating so e-bike slots are used only on e-bikes
- Library matching on category + brand + model + mpn. A blank mpn gets filled in; two parts with different part numbers are never merged.
- Re-importing keeps overrides and confirmed rows. The same input always gives the same output.
- The importer reads `slot_categories` instead of its built-in mapping.
- Stop writing the groupset name into chainring and cassette range.
- Vitest tests with the nine real strings from the audit, plus 10 before/after examples.
- The fitted-parts view shows "inferred" and "unverified" labels.

## Checkpoint 3: Backfill dry run (no writes)
- A script re-parses the 9 bikes that have parts and the 3 with catalog data. For each bike and slot it shows current vs proposed brand, model and mpn, tagged improved, unchanged or needs review.
- It flags the Trek chain linked to "SLX M7100", the Di2 battery sitting under ebike_battery, and the 11 vs 12-speed cassette clash.
- It lists every library part that would split in two, and which bikes each side attaches to.

## Checkpoint 4: 99spokes match rate (no writes)
- Look up each of the 83 bikes through `spokes-lookup` search, using make/model/year with a size check.
- Confidence score from exact make, model similarity, year and whether the size exists.
- For each bike: the match, its confidence and how many slots it would fill. Then totals (confident, weak, no match), average slots filled per matched bike, and the slots most often left empty.
- The same figures separately for the 20 bikes that are ready to list.
- Results go to `/mnt/documents/`.

## Technical notes
- Stage 0 writes only through the backup migration. Everything else in that stage is read-only.
- Stages 3 and 4 run as bun scripts using read-only queries. The 99spokes calls go through the existing server function, so the key never reaches the browser.
- Anything I'm unsure of will be reported as unconfirmed, not guessed.
