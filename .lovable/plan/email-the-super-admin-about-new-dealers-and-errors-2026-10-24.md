# Email the super admin about new dealers and errors

## Today
The super admin is only emailed about website enquiries and job applications. New dealer sign-ups waiting for approval and errors in Admin → Errors send no email; you only see them by opening the admin console.

## What changes
1. **New dealer waiting for approval** — one email per new dealership: name, contact email, sign-up time, and a link to Admin → Dealerships to approve it.
2. **Errors** — a summary email at most once an hour listing new errors (dealership, where it happened, message), grouped so the same error repeated 50 times shows once with a count. A link goes to Admin → Errors. No email if there's nothing new.
3. **Deletion requests** — one email when a dealer asks for their dealership to be deleted, with a link to Admin → Deletions.

All three go only to super admins, never to dealership staff, and each can be switched off in the admin console.

## Technical details
- Add notification kinds `dealer_signup`, `system_errors`, `deletion_request` to `_shared/email.ts`, routed to super admins like `support_ticket`.
- New scheduled edge function `platform-alerts` (every 10 minutes, cron + pg_net, like `sync-failure-alerts`): finds pending businesses and deletion requests not yet alerted, and new `system_error_logs` rows since the last error digest (sent at most hourly). Tracks what was sent in a service-role-only `platform_alert_log` table so nothing is emailed twice.
- Switches stored in the super admin's platform settings in `app_settings`; small toggle card on the admin overview page.
