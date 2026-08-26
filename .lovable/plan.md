# Fix QuickBooks "Duplicate Name Exists" on invoice sync

The VAT problem is solved — the sync now gets past the tax code step and fails at the customer step instead. QuickBooks returned error 6240: a customer with that display name already exists in the connected company, but our lookup didn't find it, so the sync tried to create a duplicate.

The lookup only matches an exact, active customer whose display name is identical to the VeloDealer name. QuickBooks rejects the create when the name matches an existing record that our query misses — typically an inactive (deleted) customer, a name differing by case or trailing spaces, or a name already used by a supplier/employee.

## Changes

- Make the customer lookup tolerant: match on trimmed name, ignore case, and include inactive customers.
- If an inactive customer matches, reactivate it and use it instead of creating a new one.
- If QuickBooks still returns "Duplicate Name Exists" (6240) on create, re-query for the existing record and use it, rather than failing the whole invoice.
- If the name is genuinely taken by another record type, fall back to a distinct display name (customer name plus a short suffix) so the invoice can still post, and note it in the sync error field.
- Apply the same duplicate handling to the service item creation, which uses the identical create-if-missing pattern and can hit the same error.
- Keep the sync retryable: no duplicate VeloDealer invoice or QuickBooks invoice is created when the retry succeeds.

## Technical detail

- Rework `findOrCreateCustomer` in `quickbooks-sync-invoice` to query `DisplayName` with a case-insensitive comparison and `active in (true, false)`, reactivating via a sparse update when needed.
- Wrap the create call so a 6240 fault triggers one re-query before erroring, and add the suffix fallback path.
- Extract the duplicate-safe create helper so `findOrCreateItem` shares it.
- Add Deno tests covering: existing active match, inactive match reactivation, 6240 race re-query, and suffix fallback.
