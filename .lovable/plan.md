# Fix "Typeform connected" flipping back to Not connected

The approval worked and the account details were saved, but Typeform did not hand back the long-lived permission token, so the Settings card decides the account is not connected and never loads your forms.

## Cause (verified)

The saved Typeform record holds an access token, expiry, account name and connect time — but no refresh token. Typeform only issues a refresh token when the sign-in request asks for offline access, which our request currently does not. Without it, the card's connected check fails immediately and the form list stays empty.

## What changes

- The Typeform sign-in request also asks for offline access, so Typeform returns the long-lived token.
- The Settings card treats an account with a valid, unexpired token as connected even while the long-lived token is still being obtained, so it no longer flips to "Not connected".
- After reconnecting, your forms list loads and you can switch on the forms you want responses from.
- You reconnect once: press Connect Typeform again and approve.

## Technical details

- `supabase/functions/typeform-oauth/index.ts`, `auth_url` action: add `offline` to the `scope` parameter (`forms:read webhooks:read webhooks:write offline`).
- Same file, `status` action: report `connected` when `is_active` and (`refresh_token` present OR `access_token` present and not expired); include a flag noting a reconnect is needed when no refresh token is stored.
- `supabase/functions/_shared/typeform.ts`, `getTypeformAuth`: when no refresh token exists but the stored access token is still valid, use it instead of throwing "Typeform is not connected"; only throw once it has expired, with a message telling the user to reconnect.
- Redeploy `typeform-oauth` and `typeform-webhook` (shared helper change).
- No database migration, no Typeform app config change; the redirect URI stays the same.
