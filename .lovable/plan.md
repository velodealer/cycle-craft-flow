# Restrict website enquiry & job application emails to the super admin

## What changes

1. **Recipients (server-side, the actual fix)** — `supabase/functions/_shared/email.ts`
   - In `resolveRecipients`, add a special case for the `support_ticket` and `job_application` kinds:
     - `addresses` mode still honoured (lets you deliberately redirect them).
     - `roles` mode ("All admins and owners") returns **only super admin emails** — looked up from `super_admins` joined to `profiles` — ignoring business and dealer admins entirely.
   - Other kinds (submissions, faults, logistics) keep the existing dealership-scoped admin/owner behaviour.

2. **Settings visibility (UI)** — `src/components/settings/EmailNotifications.tsx`
   - The whole Email notifications card renders only when `isSuperAdmin` is true (returns null otherwise). Dealers no longer see or edit the Website enquiries / Job applications toggles or any email settings.

3. **Deploy**
   - Redeploy the functions that import `_shared/email.ts`: `submit-contact`, `submit-application`, `send-test-email`, plus `typeform-webhook` (uses fault notification) and `reply-support-ticket`.

## Notes
- No database changes. Saved settings are untouched; if you ever set specific addresses for those two kinds, those addresses still win.
- Test path afterwards: send a test email from Settings → Integrations, and optionally submit the public contact form to confirm only info@velodealer.com receives it.

## Verification
- Build/typecheck clean.
- Confirm the card no longer renders for non-super-admin dealers (code path gated on `isSuperAdmin`); authenticated end-to-end check not available in this environment.
