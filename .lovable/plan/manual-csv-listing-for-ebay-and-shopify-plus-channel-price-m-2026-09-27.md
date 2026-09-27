# Manual CSV listing for eBay and Shopify, plus channel price mark-ups

## What you get
1. **Manual listing mode per channel** (Settings > Listings): toggles "eBay manual listing" and "Shopify manual listing". Turn one on when a dealership has not connected that channel. You can use both modes together (connected plus CSV).
2. **CSV export on the Listings page**: an "Export eBay CSV" and/or "Export Shopify CSV" button appears when manual mode is on for that channel. You can export every bike you have selected, or everything showing under the current filter. Each bike gets a per-bike "Add to CSV" tick.
   - **Shopify CSV**: Shopify's official product import format (Handle, Title, Body HTML, Vendor, Type, Tags, Published, Option1 Size, SKU = bike reference, Price, Compare-at, Image Src with image position, one row per extra image, Status draft or active, and SEO fields). You upload it in Shopify Admin > Products > Import.
   - **eBay CSV**: eBay Seller Hub Reports "Create listing" template (Action, Category 177831, Title max 80, ConditionID, Description (full HTML from your listing template), Start price, Quantity 1, PicURL with up to 24 images separated by pipe characters, Format FixedPrice, Duration GTC, C:Brand, C:Model, C:Bike Type, C:Frame Size, C:Colour, C:Frame Material, C:Wheel Size and more item specifics, plus the postage/returns/payment policy names from eBay settings when set). You upload it in Seller Hub > Reports > Upload.
   - Full bike details: every spec field, fitted parts (brand, model and spec, with no MPN), condition notes and listing images (your ordered listing images, falling back to bike photos).
   - Bikes missing a price, photos or a bike type still export, but a warning lists them first.
3. **Channel price mark-up** (Settings > Listings): a percentage per channel (eBay, Shopify, Squarespace), for example eBay +10%. You can also round to the nearest £5, £10 or .99 ending, or not round at all. The marked-up price is used both in CSV exports and in connected (sign-in) listings pushed to that channel. The Listings page shows "Asking £2,000 · eBay £2,200" so you always see both. Asking price and profit figures in VeloDealer stay unchanged.

## Out of scope
- No automatic re-pricing of already-live listings. The new price applies the next time a bike is listed or synced.
- Squarespace CSV is not included (you only asked for eBay and Shopify).

## Technical details
- Settings live in `app_settings` (per business, like VAT): keys `listing_manual_ebay`, `listing_manual_shopify` (bool), and `channel_markups` (jsonb `{ ebay: {pct, round}, shopify: {...}, squarespace: {...} }`). No migration is needed.
- New `src/lib/channelPricing.ts` with `applyChannelMarkup(price, rule)`, plus an identical copy in `supabase/functions/_shared/channel-pricing.ts`. Used by ebay-listing.ts (offer price), shopify-listing.ts (variant price) and the Squarespace sync; each function reads the business's `channel_markups`.
- New `src/lib/listingCsv.ts`: builds rows and escapes values as proper CSV (quotes, newlines, UTF-8 byte order mark). It reuses the existing eBay aspects/description builders and the fitted-part resolver, so the CSV matches what we would send over the connection. Downloaded in the browser as `velodealer-ebay-YYYY-MM-DD.csv` and `velodealer-shopify-YYYY-MM-DD.csv`.
- New `ListingChannelSettings.tsx` card on the Settings page. On ListingsPage, row selection checkboxes, export buttons and the marked-up price display are added, and it fetches any extra bike fields the export needs.
- Unit tests for the mark-up rounding and CSV escaping. Typecheck, build and redeploy the listing functions.
