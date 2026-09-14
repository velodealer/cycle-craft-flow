# Fix the Typeform connect screen

After approving Typeform, the browser shows raw page code instead of a "Typeform connected" message. The connection itself worked — only the confirmation screen is broken, and on a phone the window never closes by itself.

## What changes

- After approving Typeform, you are sent straight back to VeloDealer's Settings page instead of a blank Supabase page.
- Settings shows a green "Typeform connected" confirmation (or a clear error message if it failed) and refreshes the connection status automatically.
- Works the same on phone and desktop: whether the sign-in opened in a popup or a new tab, you end up back in the app.

## Technical details

- `supabase/functions/typeform-oauth/index.ts`: replace both HTML responses in the GET callback with a 302 redirect to the app's settings page, carrying `?typeform=connected` or `?typeform=error&message=...`. Keep the existing postMessage behaviour for desktop popups by having the settings page close/notify itself, so no separate HTML document is needed.
- The redirect target: pass the app origin into the authorize step via the OAuth `state` parameter (set when `auth_url` is requested from the browser, so preview, published and custom-domain all work), and fall back to the known project URL if `state` is absent or not a valid app origin.
- `src/components/settings/TypeformIntegration.tsx`: on mount, read the `typeform` query params, show a success or error toast, strip the params from the URL, and re-fetch status. Keep the existing `typeform-connected` message listener for the popup path.
- Redeploy `typeform-oauth`. No database or Typeform app config change; the redirect URI stays the same.
