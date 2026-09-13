# Typeform integration: bike sale & part-exchange submissions

Connect a Typeform account in Settings, choose which forms to listen to, map each form's questions to bike fields, and receive every submission into a review inbox where staff turn it into a bike (and optionally book collection).

## What the user gets

**Settings → Integrations → Typeform**
- "Connect Typeform" button opens Typeform's sign-in window; after approving, the card shows the connected account and a Disconnect button.
- A list of the account's forms with a toggle per form ("receive responses"). Turning a form on registers the webhook with Typeform automatically; turning it off removes it.
- A "Map fields" panel per connected form: for each bike field (make, model, year, frame/serial number, size, colour, condition notes, asking price, submission type — sale or part exchange — plus customer name, email, phone, address/postcode and photo uploads) pick which Typeform question feeds it. Saved per form.

**New page: Submissions (sidebar, admin/owner/staff)**
- Card list of incoming submissions: customer name, bike make/model, asking price, type (sale / part exchange), date, photos, and the full set of answers.
- Status per submission: New, Reviewed, Converted, Rejected.
- "Create bike" opens the existing intake form pre-filled from the mapped answers; on save the submission is marked Converted and links to the created bike.
- "Reject" with an optional reason. Text filter and status filter at the top.

## Technical plan

**Secrets**: `TYPEFORM_CLIENT_ID`, `TYPEFORM_CLIENT_SECRET` (from a Typeform OAuth app the user registers at developer.typeform.com), plus a generated `TYPEFORM_WEBHOOK_SECRET` used as the Typeform webhook signing secret.

**Database migration**
- `typeform_forms`: `id`, `form_id` (unique), `title`, `enabled`, `webhook_tag`, `field_map` jsonb, timestamps.
- `typeform_submissions`: `id`, `form_id`, `response_id` (unique — idempotent), `submitted_at`, `raw_payload` jsonb, extracted columns (`submission_type`, `customer_name`, `customer_email`, `customer_phone`, `postcode`, `bike_make`, `bike_model`, `bike_year`, `frame_number`, `asking_price`, `photo_urls` text[]), `status` (new/reviewed/converted/rejected), `bike_id` fk, `reviewed_by`, `notes`, timestamps.
- GRANTs for `authenticated` + `service_role`, RLS enabled: staff roles read/update, service role writes; no `anon` access.
- OAuth tokens (access + refresh + expiry) stored in the existing `integrations` table under name `typeform`, matching the QuickBooks pattern.

**Edge functions** (mirroring `quickbooks-oauth` / `inspectabike-webhook`)
- `typeform-oauth` (`verify_jwt = false` for the browser callback): `auth_url`, OAuth code exchange on GET callback, `status`, `forms` (GET `https://api.typeform.com/forms`), `set_form_enabled` (creates/deletes the form webhook via `PUT/DELETE /forms/{id}/webhooks/{tag}` with the signing secret), `save_field_map`, `disconnect`. Authenticated actions require an admin/owner via `requireUser`. Access-token refresh handled in a shared `_shared/typeform.ts`.
- `typeform-webhook` (`verify_jwt = false`): verifies the `Typeform-Signature` header (base64 HMAC-SHA256 of the raw body, `sha256=` prefix) before parsing, dedupes on `response_id`, applies the form's field map to `form_response.answers` (supporting text, choice, number, email, phone, file_url), inserts a submission row, returns 200 fast.

**Frontend**
- `src/components/settings/TypeformIntegration.tsx` added to the Integrations tab; `src/services/typeform.ts` for the invoke calls.
- `src/pages/SubmissionsPage.tsx` + route and sidebar entry; conversion reuses the existing intake form pre-filled from the submission, and after saving links `bike_id` and sets status.

**Setup step the user must do once**: create a Typeform OAuth app and add the callback URL `https://hgztcymscgyuekgsyyfe.supabase.co/functions/v1/typeform-oauth` as the redirect URI, then paste the client ID/secret into the secure secrets form.
