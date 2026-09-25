# Post bike breaks and part sales to QuickBooks / Xero

## What happens today
Breaking a bike posts nothing to the accounts: the Stock account keeps the whole
bike's purchase price, and selling a stripped part records only a local sale
price — no invoice, no posting. This plan adds both.

## 1. New optional account mapping — "Parts stock"
- Add a `parts_stock` account to the QuickBooks and Xero account mappings
  (Settings → Integrations), optional, with a hint: "Kept parts are moved here
  when a bike is broken. Leave empty to keep their value in the main Stock
  account."
- Shown in the existing account pickers and included in the health check.

## 2. Journal when a bike is broken (both systems)
When **Break bike** saves successfully, post a reclass journal per connected
system, independently — a failure in one never blocks the break or the other.

Basis is the purchase price that was posted to the accounts at intake (never
prep costs). Amounts:
- **Kept value** (total of the values entered in the break dialog):
  - If a Parts stock account is mapped: Dr Parts stock / Cr Stock.
  - If not mapped: no reclass — the kept value stays in the main Stock account.
- **Written-off value** (purchase price − kept value, if positive):
  Dr Cost of goods sold / Cr Stock — clears the scrapped remainder so no
  stranded value is left in Stock.
- The journal memo lists each kept item, e.g. `BPS-TRE-027T broken —
  Drivetrain £450, Wheels £280, Frame £120`, so the Stock ledger shows the bike
  replaced by its parts (1 bike becomes 3 entries).

Implementation:
- New pure line builders in `_shared/quickbooks-lines.ts` and
  `_shared/xero-postings.ts` (with tests, matching the existing style).
- New edge functions `quickbooks-break-bike` and `xero-break-bike` following the
  sync-invoice pattern; called from `BreakBikeDialog` after the local saves.
- Additive columns on `bikes`: `break_qb_posting_id`, `break_qb_sync_status`,
  `break_qb_sync_error`, and the Xero equivalents.
- The Break dialog shows what will be posted ("£770 moves to parts stock,
  £130 written off") when a system is connected; admin/owner/accountant only.

## 3. Part sales become real invoices in the accounts
- New **Record part sale** action on the parts list: enter the sale price and
  choose the VAT treatment — same options as recording a bike sale (standard
  VAT, margin scheme, or not VAT registered).
- Creates an invoice row linked to the part (new `part_id` on `invoices`,
  new `part_sale` invoice type; `bike_id` stays null).
- Posts to QuickBooks and Xero like a bike sale: customer invoice with the
  chosen VAT (margin maths identical to bike sales), plus a stock-out journal
  Dr COGS / Cr parts stock (or main Stock when no parts account is mapped).
- Customer: optional — when none is chosen, a per-dealership walk-in customer
  is used (created once, reused).
- Part-sale invoices appear on the Invoices page with Sync / Re-sync buttons
  like bike invoices.

## 4. Guard rails
- Postings only when the system is connected; "not connected" is a skip, not an
  error. Reconnect-required errors surface their existing messages.
- VAT not mapped → clear message pointing at Settings → Integrations.
- Never posts for a dealership whose QuickBooks/Xero isn't its own.
- Historical already-broken bikes are **not** backfilled; say the word if you
  want a one-off catch-up.

## Out of scope for this pass
- Reversing a part sale (void + restock) — can follow later.
- eBay/Shopify/Squarespace behaviour on break: unchanged.
