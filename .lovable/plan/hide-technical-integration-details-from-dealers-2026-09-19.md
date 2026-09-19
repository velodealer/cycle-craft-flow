# Hide technical integration details from dealers

Dealers connecting Cycle Courier Co or InspectABike currently see internal plumbing (webhook URLs, webhook secret, API documentation links, delivery-address form). Hide all of it from dealership accounts; keep it available to the VeloDealer super admin (info@velodealer.com) only.

## What dealers will see

**Cycle Courier Co card** — dealers keep only:
- Connected / Not connected badge
- "Connected as {account name}" line and reconnect warning
- Connect / Reconnect / Disconnect buttons

Hidden from dealers (shown to super admin only):
- Webhook Secret field
- Delivery Address Configuration form (recipient, email, phone, street, city, postcode, country) — the address is managed on the Cycle Courier side via the OAuth connection
- Webhook URL with copy button
- "View API Documentation" link
- The "app details not set up yet, register this return address" setup wording

**InspectABike card** — dealers keep only the connected badge, account name, and Connect/Reconnect/Disconnect. Hidden from dealers (super admin only):
- "Fault updates are sent to" webhook address field with copy button
- InspectABike API documentation link

## How

1. `src/components/settings/CycleCourierIntegration.tsx`
   - Read `useAuth().isSuperAdmin`.
   - Wrap the webhook-secret, delivery-address, webhook-URL and API-docs sections, plus the not-configured setup wording, in `{isSuperAdmin && ...}`.
   - The Save button lives inside the super-admin-only address section, so dealers never see it and its validation is unchanged.
   - Existing saved settings (webhook secret, BPS receiver address) stay in the database untouched — bookings and webhook verification keep working; only the UI visibility changes.

2. `src/components/settings/InspectABikeIntegration.tsx`
   - Read `useAuth().isSuperAdmin`.
   - Wrap the webhook-address block (label, read-only field, copy button, docs link) in `{isSuperAdmin && ...}`.

## Verification

- Build passes.
- Super admin still sees and can edit all technical fields.
- Dealership admin sees only connection status and connect/disconnect controls on both cards.
