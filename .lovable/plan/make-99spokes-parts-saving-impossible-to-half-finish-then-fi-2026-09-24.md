# Make 99spokes parts saving impossible to half-finish, then fill BPS-CAN-0032

## Why it failed
- Nothing on the database side refused the parts. There's no error, no duplicate clash, and the permissions are fine. The frame saved at 01:35:44, and then the save simply never tried the other 15.
- The parts are saved one by one **from your browser**, about half a second each (roughly 10 seconds for 16 parts). If the screen closes, the page reloads, or the phone locks or switches app in that window, the browser stops partway. The bike details had already saved, so it looked finished.
- The old code also threw away errors, so there's no trace to prove this 100%. But the timings (frame saved, then nothing, with no errors logged) fit an interrupted browser far better than a refused save.

## Fix
1. **Save all parts on the server in one go.** The app sends the whole parts list once, and the server saves every part in a single step. Either all parts save or none do, and closing the app can't cut it off halfway. The message you see reports the true result ("17 of 17 parts saved").
2. **Always save what 99spokes lists.** Brand, model and part number are saved exactly as the text gives them (for example, the bottom bracket gets BB4124). Parts are never skipped for looking inconsistent; your technician edits to confirm. The "check this" notes stay for them.
3. **Warn instead of losing parts:** if the save ever fails, the bike page shows "Parts not saved — Retry", with the reason and a one-tap retry from the stored 99spokes record.
4. **Fill BPS-CAN-0032 now** with the 17 rows you reviewed: the bottom bracket as listed (Shimano Ultegra, BB4124) and the fork as shown. Then render its eBay template and confirm the groupset, wheels and tyres appear.
5. **Find other bikes hit by the same problem:** list any bike that has a stored 99spokes record but fewer saved parts than the record holds, and show you the list. Nothing is filled without your OK.

## Not included
- Automatic listing stays paused. No bulk 99spokes import.
- The separate Checkpoint 3 backfill still waits for its own approval.

## Technical notes
- New edge function `link-spokes-components` (JWT verified, called with the user's token so the business rules still apply). It takes `{ bikeId, components[] }` and runs one database function, `link_bike_components(bike_id, jsonb)` (security invoker), inside a single transaction: look up or insert the library entry by (category, brand, model, mpn), top up blanks only, and upsert `bike_components` with the per-bike brand/model/mpn/attributes. It returns per-slot results.
- `upsertComponentsForBike` becomes a thin call to that function. `SpokesApplyDialog` and `BikeForm` keep the new result toast.
- The retry banner on the bike page compares the number of `catalog_data.components` with the `bike_components` row count and re-maps from `catalog_data` with `mapSpokesBike`.
- The BPS-CAN-0032 fill goes through the same function (not ad-hoc SQL), so it proves the new path works.
