# Email the owner when an accounting sync fails

## What it does
When a sale, purchase or part sale doesn't reach QuickBooks or Xero, the dealership's owners and admins get an email that names the bike or invoice and the reason, with a link to the dashboard so they can press Retry. Right now they only find out if they happen to open the dashboard.

- One email per failed item, not one per retry, so nobody gets spammed.
- If it's still failing the next day, one reminder email covers everything still failing.
- Emails go to that dealership only, never to another one.
- Each dealership can turn the alerts off under Settings, Email notifications.

## Live tests
Broximo's connections are working, so that counts as done for Broximo. The task stays open only for checking that a brand-new dealership can connect each service from scratch.

## Technical notes
- Add a `sync_failed` notification type to the existing `sendNotification` helper and email templates. Send it from the QuickBooks/Xero sync functions when they record a failure, and skip it if an alert for the same record and provider has already been sent (track this with a `failure_alerted_at` column or an equivalent log row).
- Send a daily summary through one scheduled call, once a day.
- Add the switch to the EmailNotifications settings.
