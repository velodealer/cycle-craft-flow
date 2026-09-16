# Email notifications with Resend

Send automatic emails from VeloDealer using your Resend account (API key already saved), with a Settings page where you choose who receives each type of email.

## Emails to send

1. **New bike submission received** — when a Typeform sell/part-exchange response arrives.
   Includes customer name, bike make/model/year, asking price, and a link to the Submissions page.
2. **Faults awaiting approval** — when InspectABike raises faults on a bike that need an approve/decline decision.
   Includes bike reference, fault list with parts/labour costs, and a link to the Repairs page.
3. **Collection / delivery updates** — when a Cycle Courier Co collection or delivery is booked, and when the courier webhook reports it collected or delivered.
   Includes bike reference, direction (inbound/outbound), status and tracking details.

All emails are sent from **notifications@velodealer.com**. This domain must be verified in your Resend account before delivery works — until then sending will fail with a Resend error, which will be shown in the app.

## Settings

New "Email notifications" card in Settings → Integrations (admin/owner only):

- Master on/off switch.
- For each of the three notification types: on/off toggle plus a recipient list.
- Recipients can be chosen as "all admins and owners" or as a list of specific email addresses typed in.
- A "Send test email" button to confirm the setup works end to end.

## Technical details

- **Storage:** new row in the existing `integrations` table, `name = 'resend'`, with `settings` JSON holding `{ enabled, from_address, notifications: { submission_received: { enabled, mode: 'roles'|'addresses', addresses: [] }, faults_awaiting_approval: {...}, logistics_update: {...} } }`. No schema migration needed.
- **Shared helper** `supabase/functions/_shared/email.ts`: `sendNotification(kind, subject, html)` — reads the `integrations` row with the service-role client, resolves recipients (querying `profiles` for admin/owner emails when in roles mode), skips silently when disabled or no recipients, and POSTs to the Resend API at `https://api.resend.com/emails` with `Authorization: Bearer ${RESEND_API_KEY}`. Direct API call, no connector gateway. Logs the Resend status and body on failure; never throws into the caller's main flow.
- **Templates** in `_shared/email-templates.ts`: small HTML builders per notification type, sharing a plain header/footer.
- **Hooks into existing functions** (each wrapped in try/catch so the primary action never fails because of email):
  - `typeform-webhook/index.ts` and `typeform-oauth` `fetch_responses` — after a submission row is inserted.
  - `inspectabike-webhook/index.ts` and `inspectabike-sync/index.ts` — after `upsertFaults`, when faults in `reported` status were newly created.
  - `create-collection-order/index.ts`, `create-delivery-order/index.ts` and `cycle-courier-webhook/index.ts` — after the order is booked or a status change is applied.
- **New edge function** `send-test-email`: validates the caller's JWT and admin/owner role, then sends a test message through the same helper.
- **Frontend:** `src/components/settings/EmailNotifications.tsx` (load/save settings via the `integrations` table, invoke `send-test-email`), added to the Integrations tab in `SettingsPage.tsx`.
- Deploy the new and modified edge functions at the end.
