# Split-for-parts filter + QuickBooks parts backfill (Broximo Prestige Steeds)

## 1. "Split for parts" on the Bikes page
- Add a **Split for parts** choice to the status filter on the Bikes page, so broken bikes can be listed on their own.
- While there, add the other missing stages already used elsewhere (In stock, Delivered) so nothing is hidden.

## 2. Backfill existing parts into QuickBooks for broxim0@outlook.com
Current state for Broximo Prestige Steeds (QuickBooks connected):
- 9 parts in stock worth £3,300, taken from 3 bikes:
  - BPS-TRE-294P (split for parts): 4 parts, £2,000 of a £2,000 purchase — nothing written off
  - BPS-BOA-XXXX (split for parts): 4 parts, £500 of a £500 purchase — nothing written off
  - BPS-BMC-1120 (still in repair, one part removed): 1 part, £800
- None have been posted to QuickBooks yet.

What the backfill does:
- For the two split bikes, post the same break entry a new break would: move each part's value from Stock to Parts stock (if a Parts stock account is mapped), and write off any leftover purchase value (£0 here).
- For BPS-BMC-1120, move only the £800 part to Parts stock; the bike stays in stock with its remaining value, no write-off.
- If no Parts stock account is mapped, there is nothing to move (values already sit in Stock), so the backfill just records the bikes as done.
- Before posting, check each bike's original purchase reached QuickBooks; any that didn't are skipped and reported rather than posted.
- Already-sold parts (9 rows with negative cost) are fitted-part usage, not stock — left alone.
- Result is recorded on each bike so it can't post twice; I'll report each QuickBooks entry number back.

## Technical details
- `BikeList.tsx`: add `SelectItem`s for `split_for_parts`, `in_stock`, `delivered`.
- Backfill: invoke existing `quickbooks-break-bike` for the two split bikes as the dealership's user. Add an optional "partial strip" mode (kept parts only, no write-off) used when the bike isn't `split_for_parts`, and skip when `break_qb_posting_id` is already set (idempotency).
- Xero is not included (not requested).
