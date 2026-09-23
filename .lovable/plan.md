# InspectABike live updates: what to tell them

**Pick "One shared address per dealer software".**

VeloDealer already has one place that takes updates for every dealer: `https://api.velodealer.com/functions/v1/inspectabike-webhook`. It works out which dealer an update belongs to from the inspection, so dealers don't need their own address. With the other option, every dealer would have to fill in an address and a secret when they connect, which is extra setup that can go wrong.

## What InspectABike should set up
- Update address: `https://api.velodealer.com/functions/v1/inspectabike-webhook`
- One signing secret for VeloDealer. They give it to you, and you paste it into VeloDealer's secure settings (I'll open the form once you have it).
- Send updates for every dealer account connected through VeloDealer.

## What changes on our side
Nothing for now. The update address already checks a dealer's own key first and falls back to the shared VeloDealer key. Once you have the secret, I'll save it, and the next inspection update will bring faults in automatically.

## Technical
- `inspectabike-webhook` resolves the business from `inspections.external_inspection_id`. It verifies with `inspectabike_connections.webhook_secret`, then falls back to `INSPECTABIKE_WEBHOOK_SECRET`.
- Next step once supplied: store `INSPECTABIKE_WEBHOOK_SECRET` via the secure secret form.
