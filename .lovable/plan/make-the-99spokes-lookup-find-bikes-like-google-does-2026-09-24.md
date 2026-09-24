# Make the 99spokes lookup find bikes like Google does

## Why it misses today
The lookup sends your whole typed phrase to 99spokes as one strict search. 99spokes only matches words that appear in the bike's name (maker, family, model, year). Words like "grey" (colour) and "r8020" (a part number, not in the model name "Aeroad CF SL 8.0 Di2 / Disc Ultegra") make the whole search return nothing. Google is more forgiving because it reads the full page text.

## What changes
1. **Paste a 99spokes link** - If you paste a link like `99spokes.com/en-GB/bikes/canyon/2019/aeroad-cf-sl-disc-8-0`, VeloDealer opens that exact bike straight away. This is the quickest fix when Google finds it.
2. **Smarter search** - Before searching, drop words that are never in bike names: colours (grey, black, red...), sizes (54cm, M, L), and part codes (R8020, R7000, M7100). A part code is turned into its groupset name instead (R8020 -> Ultegra), which 99spokes does recognise.
3. **Fallback if nothing comes back** - Retry automatically with fewer words (maker + family, e.g. "Canyon Aeroad"), then show those results with a note: "No exact match - showing closest bikes". You then pick the right year/spec from the list.
4. **Show why** - When results are loose, show which words were ignored so you know what happened.

## Technical details
- `supabase/functions/spokes-lookup/index.ts`: add query normalisation (colour/size stopwords, Shimano/SRAM code -> groupset map), progressive fallback (`prefix` full -> cleaned -> first 2 tokens), return `{ items, total, relaxed, droppedTerms }`.
- Add `action: 'resolveUrl'`: parse maker/year/slug from a 99spokes URL, search by those, match on `url`/id, return the bike.
- `src/lib/spokes.ts` + lookup dialog: detect pasted URLs, display the relaxed-match notice and dropped terms.
- No database changes; automatic listing stays paused.
