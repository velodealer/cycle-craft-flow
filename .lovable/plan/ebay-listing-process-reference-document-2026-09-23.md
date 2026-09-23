# eBay listing process — reference document

Create one markdown file, `docs/ebay-listing-process.md`, that explains end to end how a bike goes from VeloDealer to a live eBay listing, and every field sent to eBay.

## Sections

1. **Overview**: the flow from connecting eBay, to the bike being ready, to pressing List, to the listing going live and syncing.
```text
Connect eBay (per dealership) -> policies + despatch location -> bike data
 -> inventory item (PUT) -> offer (POST/PUT) -> publish -> listing URL saved
```
2. **Connecting**: OAuth per dealership, sandbox vs live, what Disconnect does, the third-party access link.
3. **Settings and defaults**: marketplace, category, postage/payment/returns policies (create and edit inside VeloDealer), the business-policy opt-in error 20403, despatch location (merchantLocationKey).
4. **Inventory item payload**: SKU, title, `description` (plain-text summary, 4,000 character limit, cut at a sentence), condition and conditionDescription, images, quantity.
5. **Condition mapping**: table of each condition, its eBay id, the fallbacks, and how conditions are checked against the category.
6. **Item specifics (aspects)**: table of each aspect (Bike Type, Type, Brand, Model, Frame Size, Colour, Frame Material, Wheel Size, Number of Gears, Brake Type, Suspension Type, Gender, Year), the VeloDealer field it comes from, the Bike Type mapping table, and how the category's required aspects are checked.
7. **Offer payload**: price, currency, categoryId, policy ids, listingDescription (the rendered listing format, up to 500,000 characters), marketplace, format.
8. **Listing format (template)**: how the dealer's own format is chosen before the default one, what the tidy-up step keeps and removes (keeps `<style>`, removes outside stylesheets and scripts), the first 800 characters becoming the mobile summary, and the full list of `{token}` fields (bike details, blocks, `part_*`, `spec_*`).
9. **Headers and language**: Accept-Language and Content-Language set for each marketplace.
10. **After listing**: what is stored for each listing (listing id, www URL, status, business), updates, removing a listing, activity log entries, notifications.
11. **Errors and fixes**: table of the errors we have hit (Accept-Language, Bike Type missing, invalid condition, description length, 20403, location not found) with the cause and what the dealer should do.
12. **Who can list**: admin, owner and customer_service roles.

## Technical details
- Before writing, re-read the source for exact values: `supabase/functions/_shared/ebay-listing.ts`, `_shared/ebay.ts`, `_shared/listing-template.ts`, `ebay-oauth/`, `ebay-sync-bike/`, `src/lib/listingTemplate.ts`.
- Only documentation changes. No code or database changes.
- Also add a copy to Files (`/mnt/documents/ebay-listing-process.md`) so it can be downloaded.
