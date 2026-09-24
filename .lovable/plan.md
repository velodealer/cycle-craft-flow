# Fill BPS-CAN-0032's fitted parts from 99spokes, and stop the import failing silently

## What's confirmed
- BPS-CAN-0032 has the full 99spokes component list saved (16 parts: fork, rims, chain, crank, frame, tyres, brakes, saddle, cassette, seatpost, shifters, rotors, brake levers, bottom bracket, rear and front derailleur), with names like "Shimano Ultegra R8000", "DT Swiss ARC 1600", "Continental Grand Prix 5000 25mm".
- Its fitted-parts list has only one empty frame row.
- The step that turns the 99spokes list into fitted parts skips any part that fails to save and tells nobody. So the real reason these 16 parts were dropped isn't confirmed yet.

## Steps
1. **Find the real cause.** Run the same save steps for this bike and record the exact error for each part (possible causes: a library lookup finding two matching entries, a save being refused, or the "add components" box not being ticked in the dialog). The fix follows whatever the errors show.
2. **Make failures visible.** The import reports "12 of 16 parts linked, 4 failed: …" with the reasons, instead of quietly skipping.
3. **Fix the cause** found in step 1, following the Checkpoint 2/3 rules: the bike's own 99spokes text first, part numbers only when written in the text, per-size text resolved to this bike's size (XXXS), and the shared library only topped up — never overwritten.
4. **Fill BPS-CAN-0032** by re-running the fixed import for this one bike only. First, show you the 16 rows it will write (slot, brand, model, part number, detail) and wait for your OK.
5. **Check it:** render its eBay template and confirm groupset, wheels and tyres come through.

## Not included
- No bulk re-import of other bikes, and automatic listing stays paused.
- The Checkpoint 3 backfill for the other 9 bikes is still waiting for your separate approval.

## Technical notes
- `upsertComponentsForBike` in `src/lib/spokes.ts`: stop ignoring errors (`continue` on insert error, ignored `linkError`, `maybeSingle` erroring on duplicates, which is a known collision). Return `{ linked, failed[] }` and show it in `SpokesApplyDialog`.
- Write through `_shared/part-parser.ts` logic so the values saved per bike (brand/model/mpn/attributes) match the renderer.
