# Fix Shopify import error "Value requires that you select a metaobject"

## What's wrong
Shopify rejected `shopify-BPS-TRE-244R.csv` because some columns are filled with plain text where Shopify expects a pick from a list. Shopify's own category fields (namespace `shopify.` — Colour, Bicycle features, Age group, Cable type, Closure type, Compatible bike type, Cycling style) only accept the store's own saved options, not free text. Our auto-matching links "Color pattern" to the bike's colour, so text like "Grey" is written into it and the whole product fails.

## Changes
1. **Never write text into Shopify category fields.** Any column in the `shopify.` namespace is always left blank in exports, whatever the saved mapping says (covers Broximo's already-saved layout — no re-upload needed).
2. **Settings screen:** those columns show as "Shopify list field — set in Shopify admin" and can't be mapped, with a one-line explanation.
3. **Auto-matching:** stop suggesting colour for "Color pattern".
4. **Safety for custom list fields:** in Settings, add a per-column "Leave blank (list field in Shopify)" note in the help text so a dealer can blank any of their own `custom.` fields that Shopify reports the same error for.

## Check
- Rebuild BPS-TRE-244R's file and confirm all `shopify.` columns are empty and other metafields unchanged.
- Ask you to re-import it in Shopify.

## Technical details
- `src/lib/shopifyTemplate.ts`: add `isShopifyListField(header)` (`metafieldOf(h)?.ns === 'shopify'`); `autoMatch` returns '' for these; remove `'color pattern'` synonym.
- `src/lib/listingCsv.ts`: when resolving template metafield columns, output '' for `isShopifyListField`.
- `src/components/settings/ShopifyTemplateSettings.tsx`: disable the dropdown for those headers with the explanation.
- No database or edge function changes.
