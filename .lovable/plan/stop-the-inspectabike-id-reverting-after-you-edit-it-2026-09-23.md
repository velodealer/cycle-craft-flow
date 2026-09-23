# Stop the InspectABike ID reverting after you edit it

## What's wrong
When you change the inspection ID in "Edit InspectABike link" and press Save, it goes back to the old value (d1ba7161-…). There are two causes:
1. The save screen skips your typed ID when it matches the number in the report link, and keeps the old one.
2. Refresh then saves whatever ID InspectABike sends back. That overwrites your edit too.

## Fix
- **Save exactly what you type.** Whatever is in the inspection ID box gets saved as-is. An empty box clears it.
- **Refresh won't overwrite an ID you set by hand.** Refresh only fills the ID in when it's blank. If InspectABike sends back a different ID, the bike keeps yours and a small note shows both numbers.
- **Try your ID first.** When looking up the inspection, Refresh tries the ID you typed before anything else. If that fails, it tries the report link number and then the reference.
- **Clear message** if your ID isn't recognised. It lists what was tried, and your edit is still kept.

## Technical
- `EditInspectABikeLinkDialog.tsx`: remove the `typedIsReport` logic and write `v.external_inspection_id || null`.
- `inspectabike-sync/index.ts`: order lookups as `id=extId`, `report_id=extId`, `report_id=fromUrl`, `id=fromUrl`, then the references. On update, set `external_inspection_id` from `remote.id` only when the stored value is null. When they differ, return `warning`. Fault ids fall back to the stored ID.
- Redeploy inspectabike-sync.
