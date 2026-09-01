# Improve 99spokes search results readability

## Problem
In the bike lookup results (mobile especially), the bike name is truncated to one line ("2026 Specialized Ta…") and the only subtitle is "road · race", so you can't tell the bikes apart. The user wants the full name readable and the groupset + wheel info shown on its own subtitle line.

## Changes

### 1. Edge function — return groupset & wheels with search results
File: `supabase/functions/spokes-lookup/index.ts`
- Extend `SEARCH_INCLUDE` to also request `gearing,components` (and keep `thumbnailUrl,suspension`).
- For each search item, derive:
  - `groupset`: from `components.rearDerailleur` (`maker + model`, falling back to `display`), else shifters.
  - `wheelSize`: from the wheel kinds (e.g. `700c`, `29"`).
- Include both fields in the returned items.

### 2. Types & local catalogue
File: `src/lib/spokes.ts`
- Add `groupset?: string | null` and `wheelSize?: string | null` to `SpokesSearchItem`.
- In `searchLocalCatalog`, derive the same fields from the saved `components` JSON so locally saved bikes show the same subtitle.

### 3. Results list UI
File: `src/components/management/SpokesLookup.tsx`
- Let the bike name wrap (remove single-line truncation) so the full "2026 Specialized Tarmac SL7 Comp" is readable.
- Add a third line under the category subtitle showing groupset and wheels, e.g. `Shimano 105 Di2 · 700c`, only when present.
- Apply the same to the "selected" summary card.

## Verification
- Run a live search ("Tarmac sl7") via the preview on a 360px viewport and confirm full names and the groupset/wheels subtitle render without breaking the dialog layout.
- Typecheck/build clean.
