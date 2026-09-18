# Fix QuickBooks "sandbox" badge and remove the redirect URI note

## Why it still says sandbox

The environment is read by the QuickBooks edge functions, and Supabase edge functions keep the secret values from when they were last deployed. Your new production values are saved correctly, but the running function hasn't picked them up yet — redeploying the functions fixes it. A page refresh afterwards will show the `production` badge.

## Changes

1. **Remove the redirect URI note** in `src/components/settings/QuickBooksIntegration.tsx` (the "Add this redirect URI to your Intuit developer app before connecting: https://api.velodealer.com/functions/v1/quickbooks-oauth" block, around line 251). One-time setup info, no longer needed on screen.
2. **Redeploy the QuickBooks edge functions** (`quickbooks-oauth`, `quickbooks-sync-invoice`, `quickbooks-sync-purchase`, `quickbooks-capabilities`) so they load the updated `QUICKBOOKS_ENVIRONMENT=production` and production keys.
3. Verify: call the status check afterwards and confirm the environment reads `production`.

## After it's live

- Refresh Settings → Integrations — the badge will say **production**.
- Then Disconnect and Connect to QuickBooks once to link your real company (the existing connection is to the sandbox company).
