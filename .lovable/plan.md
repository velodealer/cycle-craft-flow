# Show the photos on bike submissions

## What's wrong

The photo links are being saved — every recent submission has one. But the link points back to Typeform's own private file service (a `api.typeform.com/.../files/...` address), which only opens for someone holding the Typeform login token. A browser loading the picture has no token, so the image just fails to appear on the Submissions page.

## The fix

Copy each uploaded picture out of Typeform and into our own photo storage as soon as a submission arrives, then show our copy.

- When a response comes in, the file is downloaded using the Typeform connection and saved into the existing `bike-photos` store under a `typeform/<response id>/` folder.
- The submission then holds our own openable link, so photos show on the submission cards and in the detail popup — and carry over correctly when the submission is turned into a bike.
- The same happens for responses pulled in with "Fetch recent responses".
- One-off repair pass for the submissions already received: a "Fix submission photos" action re-fetches their pictures into our store and updates the links.
- If a download fails, the submission still saves — the photo is simply skipped and the failure is logged, so nothing is lost.

## Technical notes

- New shared helper `supabase/functions/_shared/typeform-files.ts`: given a Typeform access token and a list of `file_url`s, fetches each with `Authorization: Bearer <token>`, uploads via the service-role client to the `bike-photos` bucket at `typeform/<response_id>/<n>-<filename>`, returns public URLs (falls back to the original URL on failure).
- `typeform-webhook/index.ts`: after `extractFromFormResponse`, calls the helper (obtaining the token through `getTypeformAuth`) and stores the rehosted URLs in `photo_urls`. Wrapped in try/catch so insert still happens on failure.
- `typeform-oauth/index.ts` `fetch_responses`: same rehosting on the recovery path.
- New action `rehost_photos` in `typeform-oauth` (admin/owner): loops over submissions whose `photo_urls` still contain `api.typeform.com`, rehosts and updates each row; surfaced as a button in `TypeformIntegration.tsx` via `src/services/typeform.ts`.
- Confirms the `bike-photos` bucket is public (used elsewhere for bike photos via `getPublicUrl`); no schema changes.
