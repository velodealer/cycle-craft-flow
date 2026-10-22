# Per-dealer settings, photo lock-down, read-only catalogue, wording

## 1. Three settings become per dealership
The bike reference prefix, default delivery charge and "VAT registered" switch are each stored once for the whole platform today. Each dealership gets its own copy.
- Broximo keeps its current values (prefix BPS, delivery £75). Every other dealership starts from the defaults (VAT registered on, no delivery charge, a generic prefix) and can change them in Settings or during onboarding.
- New bike references use the creating dealership's own prefix.
- Invoicing, Xero/QuickBooks and Shopify sales read the VAT switch for the right dealership.

## 2. Old photos
The 26 photos with no recorded uploader are all **Typeform submission photos** that the server saved automatically (16 Sept – 20 Oct). None are bike photos. They're still shown on the Submissions page, so they won't be deleted.
- Fix: new and existing submission photos are filed under the dealership they came in for. Only that dealership's staff can change or delete them. No photo will be left without an owner.

## 3. Shared bike catalogue
- Dealers can no longer edit or delete catalogue entries. Only the super admin can.
- When a dealer fills in bike details from a search, a bike that isn't in the catalogue yet is still added automatically, so it's found instantly next time.
- The catalogue's "times used" count still goes up, but through a controlled server action instead of a direct edit.

## 4. Remove "99Spokes" wording
Every visible mention in the app becomes neutral wording, for example the button "Fill in bike details" and "Bike details found". Covered: bike form, lookup, apply dialog, full spec view and specification section, plus the public Features, Updates and Terms pages. Internal code names stay as they are; nobody sees them.

## Technical details
- Rekey `app_settings` to `bike_reference_prefix:<business_id>`, `default_delivery_charge:<business_id>` and `vat_registered:<business_id>`. Copy the existing global rows to Broximo's keys, then delete the old ones. Update `useVatRegistered`, `VatSettings`, `BikeReferenceSettings`, `DeliverySettings` and `RecordSaleDialog`, plus the `shopify-webhook`, `quickbooks-sync-invoice` and `_shared/xero.ts` reads, and redeploy them. `generate_bike_reference` reads the prefix by the bike's business.
- Typeform uploads go to `typeform/<business_id>/...`, existing objects are moved, and stored submission URLs are updated. A storage restrictive policy checks that the path prefix equals `current_business_id()`. Remove the `owner IS NULL` allowance.
- `catalog_bikes`: drop the open UPDATE policy, set DELETE/UPDATE to `is_super_admin()`, keep INSERT for authenticated, and add a security-definer `bump_catalog_use(id)` RPC that `src/lib/spokes.ts` calls instead of a direct update.
- Text-only edits in the listed components and pages.
