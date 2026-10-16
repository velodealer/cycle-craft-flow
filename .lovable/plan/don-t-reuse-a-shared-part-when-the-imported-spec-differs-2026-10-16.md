# Don't reuse a shared part when the imported spec differs

## Problem
When a 99Spokes import brings in a part, the save step reuses any existing library part with the same category, brand, model and part number. BPS-BMC-1044's crank ("SRAM RIVAL AXS 46-33T") was matched to the shared "SRAM Rival" crank, whose description came from another bike ("Rival D1 DUB 33/46 with Power Halo power meter"). eBay then showed that other bike's description.

## Change
1. **Matching rule for imports** — reuse an existing library part only if its description is empty or the same as the imported one (ignoring case and spacing), and its stored attributes don't contradict the imported ones. If the spec is different, create a new library part with the imported brand, model, part number and description, and link the bike to it.
2. **Fix BPS-BMC-1044 now** — give the crank its own library part using this bike's text ("SRAM RIVAL AXS 46-33T"), then re-sync the eBay listing.
3. **Find other affected bikes** — list every bike whose own saved part note differs from the description of the shared part it's linked to. Show that list before splitting anything. Then give each affected bike its own matching part after you approve.

## Technical details
- Update `link_bike_components` (migration) with a normalized description comparison and an attributes-conflict check (same key, different value) before reuse; otherwise insert a new `components` row (source `99spokes`).
- Stop filling a blank `description` on a reused row with another bike's text — that filling step is how the Power Halo text ended up on the shared crank.
- The data fix for BMC-1044 and the audit query run as data operations, not migrations.
- Add a regression test: same brand/model/MPN with a different description creates a new component; the same description reuses the existing one.
