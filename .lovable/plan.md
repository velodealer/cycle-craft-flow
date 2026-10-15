# Generate listing descriptions from the bike spec

## What we found

99Spokes has no description field. Its records contain only structured data: components (maker/model/description per part), geometry, sizes, colours, prices, images. There is no manufacturer marketing text or recommended listing copy to pull in.

## What we'll build

A "Generate description" option that writes a listing description from the bike's own details and its 99Spokes spec — no invented claims, only what's on record.

### 1. Description generator (shared logic)

- New helper that builds a description from: bike name/year, condition grade, frame material and size, groupset, wheelset, brakes, tyres, plus fitted parts and any condition notes already on the bike.
- Output is plain factual sentences, e.g. "2020 Specialized Roubaix Comp with Shimano Ultegra Di2 groupset, DT Swiss R 470 wheels and hydraulic disc brakes. Size 54cm carbon frame. Condition: very good."
- Never invents history, mileage or ownership claims — only uses values actually stored on the bike.
- Shared between the app and listing functions so the preview matches what goes to eBay/Shopify/CSV.

### 2. Where it appears

- Bike page, description field: "Generate from spec" button fills the description box; the user can edit before saving. Existing text is never overwritten without confirmation.
- Listing templates: a `{{generated_description}}` token so templates can include it.

### 3. Optional AI polish (needs your go-ahead)

- Optional "Improve wording" using Lovable AI to make the generated text read naturally, still restricted to the stored facts.
- Included only if you want it; the factual generator works without it.

## Technical details

- New `src/lib/listingDescription.ts` with a Deno mirror in `supabase/functions/_shared/` for parity (same pattern as channel pricing).
- No database changes; description stays in the existing bike description field.
- Tests for the generator: spec-only bike, bike with fitted parts, bike with condition notes, empty-spec bike (falls back to name/condition only).

## Not included

- No changes to 99Spokes lookup or stored raw data.
- No automatic overwriting of descriptions already written.
