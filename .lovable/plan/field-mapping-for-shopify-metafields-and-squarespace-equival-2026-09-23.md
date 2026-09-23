# Field mapping for Shopify metafields and Squarespace equivalents

## What you get
A new **Field mapping** section in Settings → Listing Formats, on the Shopify and Squarespace tabs, under the description template.

- **Shopify:** a table of rows: *Metafield* (namespace.key, e.g. `bike.frame_size`) → *Type* (single line text, number, true/false, multi-line text) → *Value* (any `{field}` from the existing field list, e.g. `{size}`, `{spec_drivetrain_groupset}`, `{part_fork}`). Add, remove and reorder rows. Preset button adds a sensible starter set (brand, model, year, size, colour, frame material, wheel size, groupset, bike type, condition, e-bike).
- **Squarespace:** Squarespace has no metafields, so the section maps to what it does support:
  - **Tags** — list of `{field}` values (replaces today's fixed make/type/size tags)
  - **Categories** — list of `{field}` values
  - **SEO title** and **SEO description** — templates
  - **URL slug** — template (e.g. `{make}-{model}-{year}-{reference}`)
- Live preview of each mapping against the sample bike. Empty values are skipped (never sent blank).
- Listing and "Sync listing" send these mappings every time, so updating a bike updates its metafields/tags.

## Shopify notes
- Metafields are written on the product with the listing. VeloDealer also creates the matching metafield definitions in the store (so they're visible and usable in the store's theme) the first time a key is used.
- If a store already defines a key with a different type, the listing still succeeds and the bike's panel shows a warning naming the key.

## Technical details
- Schema: add `field_map jsonb not null default '[]'` to `listing_templates` (per business, per platform). No new tables; existing RLS applies.
- Shared: `renderFieldValue(token string, bike, components)` in `src/lib/listingTemplate.ts` and the Deno copy in `_shared/listing-template.ts`, reusing the existing token renderer (plain text, trimmed).
- `_shared/shopify-listing.ts`: load mapping via `loadListingTemplate('shopify')`, add `metafields: [{namespace,key,type,value}]` to `productSet`/product input; best-effort `metafieldDefinitionCreate` (ownerType PRODUCT) cached per shop; user errors surfaced into `shopify_listings.last_error` as a warning. Existing `write_products` scope covers this — no reinstall.
- `_shared/squarespace-listing.ts`: apply tags, categories, `seoOptions {title, description}` and `urlSlug` on create and update.
- UI: `ListingFormats.tsx` gets a `FieldMappingEditor` shown for `shopify`/`squarespace`; saved with the template upsert. Key format validated (`namespace.key`, letters/numbers/underscore, 3–64 chars).
- Redeploy shopify-sync-bike and squarespace-sync-bike.
