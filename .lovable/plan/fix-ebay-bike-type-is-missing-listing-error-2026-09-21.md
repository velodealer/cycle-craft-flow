# Fix eBay "Bike Type is missing" listing error

## What is happening

eBay's bikes category requires an item specific called **Bike Type** with one of eBay's own values (Road Bike, Mountain Bike, Hybrid Bike, and so on).

Right now VeloDealer sends the bike's type under the label **Type**, and it sends the internal code (`mtb_hardtail`, `tt`, `mtb_full_sus`) rather than a name eBay recognises. eBay therefore sees no Bike Type at all and refuses to publish the listing.

## The fix

1. Send the field under the name eBay expects (**Bike Type**), and keep sending the readable type as well.
2. Translate each VeloDealer bike type into the matching eBay value, for example:
   - Road, Time Trial, Track, Cyclocross, Touring, Gravel -> the closest eBay road/gravel value
   - MTB hardtail and full suspension -> Mountain Bike
   - Hybrid, City, Folding, Cargo, BMX, Tandem, Recumbent, Children's, Electric -> their eBay equivalents
3. Ask eBay, per category, which item specifics are required, and fill them from the bike where we hold the information (brand, frame size, colour, frame material, wheel size, gears where known).
4. If a bike has no type recorded, stop before sending to eBay and show a plain message: "Add a bike type before listing on eBay", instead of the raw eBay error.
5. Keep the same behaviour for every other field — nothing else about the listing changes.

## Technical detail

- `supabase/functions/_shared/ebay-listing.ts`: add an `EBAY_BIKE_TYPE` map from VeloDealer `bike_type` slugs to eBay aspect values; in `aspects()` emit `Bike Type` (plus `Brand`, `Frame Size`, `Colour`, `Frame Material`, `Wheel Size`, `Year`) and drop the unrecognised `Type` key and the null `Wheel Size` entry.
- Add a cached call to the Taxonomy API (`/commerce/taxonomy/v1/category_tree/3/get_item_aspects_for_category`) for the offer's `categoryId`, so required aspects are known and any we can fill are added automatically; missing required aspects we cannot fill are reported as a readable list.
- `pushBikeToEbay`: validate before the publish call and throw a friendly error naming the missing details.
- Redeploy `ebay-sync-bike` and confirm by listing bike `BPS-TRE-027T` and reading the function logs.
