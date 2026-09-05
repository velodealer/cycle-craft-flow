# Fix the sale error and add draft sales

## The error

Recording a sale fails with `fulfillment_type_check`. When the sale is saved, the app writes "collection" or "delivery" into a field on the bike that only ever accepts two other values ("fulfilled by BPS" or "stocked by me"), so the database rejects the whole save. The bike already has a separate delivery-method field intended for this.

Fix: store collection/delivery in the delivery-method field and stop touching the fulfilment-type field during a sale. Everything else about the sale (invoice, part exchange, QuickBooks, courier booking) stays as it is.

## Save a sale as a draft

A "Save as draft" button next to "Record sale" in the sale dialog.

A draft keeps everything on hold:
- The bike stays in stock — not marked sold.
- No invoice number is used and no invoice is created.
- No part-exchange bike is created.
- Nothing is sent to QuickBooks and no delivery is booked.

On the bike page a "Sale draft saved" note appears with the sale price and customer, and buttons to continue the draft (reopens the dialog with everything filled in), or discard it. Confirming from the reopened dialog runs the normal sale, exactly as today, and clears the draft.

Only one draft per bike; saving again replaces it.

## Technical detail

- `RecordSaleDialog.tsx`: replace `fulfillment_type` in the bike update with `delivery_method` ('collection' | 'delivery').
- New table `public.sale_drafts`: `bike_id` (unique), `payload` jsonb holding the full dialog state, `created_by`, timestamps, updated-at trigger. Grants for `authenticated` and `service_role`; RLS allowing staff roles (same role set already used for bikes) to read/write, plus admin delete.
- `RecordSaleDialog` gains `initialDraft` loading, a `saveDraft` action (upsert by bike id), and deletes the draft after a successful sale.
- `BikeDetailView` loads any draft for the bike and shows the draft banner with Continue / Discard.
