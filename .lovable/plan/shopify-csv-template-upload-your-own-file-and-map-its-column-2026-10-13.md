# Shopify CSV template: upload your own file and map its columns

## What the dealer gets
In Settings → Listing Formats → Shopify, a new **Your Shopify CSV template** section:

1. **Upload**: the dealer uploads a product export from their own Shopify store (Shopify admin → Products → Export). Only the header row is read; the products in the file are ignored and never imported.
2. **Map**: we list every column in their file.
   - **Standard Shopify columns** (Handle, Title, Body, Vendor, Type, Tags, Variant price/SKU/qty, images, SEO Title/Description, Google Shopping fields and so on) fill in automatically, following best practice. Dealers can't change these.
   - **Metafield columns** in their own wording, e.g. "Handlebar (product.metafields.custom.handlebar_stem)", get a dropdown to pick the bike field. Options are: make, model, year, size, colour, frame material, condition, condition notes, RRP, any spec value, any fitted part (crankset, wheels, tyres...), a fixed text, or "Leave blank".
   - We pre-fill the most likely match by comparing names (e.g. Crankset → fitted crankset, Size → size, Brand → make, RRP → RRP). Columns we can't match start as "Leave blank".
3. **Save**: the mapping is saved for that dealership. The dealer can re-upload to add new columns, or reset to our default export.

## How exports change
- Once a template is saved, every Shopify CSV download uses **exactly their columns, in their order**. That covers the bulk export and the per-bike "List on Shopify (manual)" button, so the file imports straight into their store.
- Without a template, exports stay as they are today.
- SEO and Google columns are always filled. SEO title is built from year, make, model and size and capped at 70 characters. SEO description is the plain-text description, capped at 320 characters. Google condition is set to used or new. MPN is left blank. Mark-up, prefix/suffix and listing-images-only rules still apply. Extra image rows go under the same Handle, as Shopify expects.
- Yes/no metafields such as "Brand new bike?" export as TRUE/FALSE.

## Technical details
- Store the template inside the existing `listing_channels:<business_id>` settings as `shopifyTemplate: { headers: string[], mapping: Record<header, source> }`. `normaliseChannelSettings` is extended to cover it. No database changes.
- New `src/lib/shopifyTemplate.ts`:
  - parses the header row, so quoted commas are handled
  - classifies each column as standard or metafield (pattern `(product.metafields.ns.key)`)
  - defines the source catalogue and auto-match
  - provides the value resolver
- Standard columns get a fixed resolver map that reuses the existing helpers in `listingCsv.ts` (title, body HTML, price with mark-up, images, plain text).
- `buildListingCsv('shopify', …)` uses the template headers and resolvers when a template exists; otherwise it uses the current fixed layout.
- New mapping UI component in Settings, with a searchable select per metafield column and a preview of one sample bike's values.
- Add an AGENTS.md rule: Shopify exports follow the dealer's uploaded header template when present, and standard columns are always system-filled.
