# Reversing sales, deleting invoices, and booking delivery

Three connected pieces of work: undo a sale cleanly, delete an invoice safely, and handle how a sold bike reaches the customer.

## 1. Reversing a sale (status change away from Sold)

When an admin changes a bike's status from Sold to anything else, the confirmation dialog becomes a "reverse this sale" dialog that lists exactly what will be undone:

- The sale invoice for that bike is deleted.
- The QuickBooks invoice is voided and the stock-out journal deleted, so the ledger matches.
- Any part-exchange bike taken in on that sale is deleted along with its stock-in journal in QuickBooks (as agreed — it never really came in).
- The bike's sale price, sold date and sale note are cleared, and the new status is applied.
- A history entry records who reversed the sale and when.

If the QuickBooks side fails (for example the connection has lapsed), nothing is deleted — you get a clear error and can retry, so the books and VeloDealer never drift apart.

## 2. Deleting an invoice

The Invoices page gets a delete action (admins only) with the same confirmation, running the same reversal: QuickBooks invoice voided, journals removed, part-exchange bike removed, and the bike moved off Sold back to "Ready for sale" (or "Listed" if it was listed before). Paid invoices show an extra warning before deleting.

## 3. Delivery or collection at point of sale

The Record Sale dialog gains a fulfilment choice:

- **Customer collection** — nothing further, the bike is marked ready for collection.
- **Delivery** — a £75 delivery charge, with a toggle for whether it is charged to the customer (added as a delivery line on the invoice and in QuickBooks, increasing the amount due) or absorbed as an internal cost against the bike (invoice unchanged, profit reduced). The £75 default is editable and configurable in Settings.

Choosing Delivery also books the outbound job with Cycle Courier Co: the shop is the sender, the customer's address (captured in the dialog, pre-filled from their record) is the receiver. The booking, its tracking number and status appear on the bike page alongside the existing inbound collection status, and courier webhook updates flow through as they already do for collections.

If the courier booking fails, the sale and invoice are still saved and you get a retry button — the sale never blocks on the courier.

## Technical notes

**Database**
- `bike_collections` gains a `direction` column (`inbound` default / `outbound`) plus `receiver_*` fields for the customer-side address, so outbound deliveries reuse the same table and webhook handling. Existing rows backfill to `inbound`.
- `invoices` gains `delivery_charge` and `delivery_charged_to_customer`; `bikes.delivery_cost` is used when the charge is absorbed internally.
- New `app_settings` key `default_delivery_charge` (75).

**Edge functions**
- New `reverse-sale` function (admin-only, service role): resolves invoice + part-ex bike, voids the QBO invoice, deletes the stock-out and part-ex stock-in journals via the existing `_shared/quickbooks.ts` fetcher, then deletes the rows and resets the bike in one pass. Both the status-change path and the invoice-delete path call it.
- `create-collection-order` extended (or a sibling `create-delivery-order`) to post an outbound order with sender = shop / receiver = customer, writing an `outbound` row in `bike_collections`.
- `quickbooks-sync-invoice` adds the delivery line to the invoice when the charge is billed to the customer, using the standard-rate sales tax code.

**Frontend**
- `AdminStatusSelect.tsx`: sold → other triggers the reversal dialog.
- `InvoicesPage.tsx`: delete action + confirmation.
- `RecordSaleDialog.tsx`: fulfilment section (collection vs delivery, charge amount, charge-to-customer toggle, delivery address).
- `CollectionStatus.tsx`: shows outbound deliveries as well as inbound collections.
- Settings: default delivery charge field.
