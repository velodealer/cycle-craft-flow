# Restore email settings for dealers

The email notifications card is currently hidden from everyone except the super admin. That was too much — dealers should be able to configure their own email alerts again.

## What changes

- The email settings card comes back for dealership owners and admins, moved into Settings > System (below the VAT setting) instead of sitting in Integrations.
- Dealers can configure and switch on/off:
  - New bike submission received
  - Repairs awaiting approval
  - Collection and delivery updates
  - Who receives each one (all admins and owners, or specific addresses)
  - The master "Send emails" switch and the test email button
- Only the super admin keeps seeing:
  - Website enquiries (contact form)
  - Job applications
  - Sender address and the link address used in emails

Website enquiries and job applications still go to the super admin only — that routing does not change.

## Technical notes

- `src/components/settings/EmailNotifications.tsx`: remove the `!superAdmin` early return (keep the loading guard); filter `KINDS` so `support_ticket` and `job_application` render only when `superAdmin`; keep the existing `superAdmin` gate on the from-address / app-url block.
- `src/pages/SettingsPage.tsx`: move `<EmailNotifications />` out of the Integrations tab into the System tab after `<VatSettings />`.
- No change to `supabase/functions/_shared/email.ts` — `resolveRecipients` keeps sending support tickets and job applications to super admins only.
