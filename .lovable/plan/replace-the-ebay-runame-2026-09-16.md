# Replace the eBay RuName

Swap the saved eBay RuName for a new value, without changing any code.

## What happens

1. Open the secure form so you can paste the new RuName; it replaces the stored `EBAY_RU_NAME` value.
2. No code, database, or deployment changes — the integration reads that value at sign-in time.

## What you need

- The new RuName must belong to the same eBay application whose App ID and Cert ID are already saved, and it must match what eBay shows in the developer portal (Application Settings → Auth'n'Auth). Use the **sandbox** RuName while the integration is in sandbox.
- Existing connected accounts keep working; the RuName is only used when starting a new sign-in.

## After the swap

If the new RuName points to a different eBay app, reconnect from Settings → Integrations → eBay. If it's the same app, nothing else is needed.
