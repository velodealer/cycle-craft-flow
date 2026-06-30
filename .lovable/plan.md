
## Listing Format Templates

Add per-platform listing templates (eBay, Shopify, Instagram, Facebook) that admins create in Settings, then render and copy from any bike detail page.

### 1. Database
New table `listing_templates`:
- `id uuid pk`
- `platform text` — one of `ebay | shopify | instagram | facebook` (unique)
- `format text` — `html` or `text`
- `body text` — the template with `{placeholders}`
- `updated_at`, `updated_by`

RLS: admins read/write; all authenticated read (so non-admin sellers can still copy on bike page). Standard GRANTs.

### 2. Settings page — new "Listing Formats" tab
File: `src/pages/SettingsPage.tsx` add a 5th tab `Listing Formats` (admin only — already gated).

New component `src/components/settings/ListingFormats.tsx`:
- Sub-tabs: eBay / Shopify / Instagram / Facebook
- Each panel: format toggle (HTML / Plain text), large `Textarea` for body, Save button
- Sidebar "Available fields" list showing every supported `{placeholder}` the user can drop in (clickable to insert at cursor)
- Live preview box rendering against the most recently updated bike (or just showing raw with placeholders highlighted)

### 3. Placeholder fields
Pull from `bikes` row + computed extras. Supported tokens:

```text
{make} {model} {year} {colour} {size} {gender} {frame_material}
{frame_number} {serial_number} {bike_type} {condition} {condition_notes}
{description} {listing_description} {weight_kg} {is_electric}
{has_suspension_fork} {has_rear_shock} {has_dropper}
{accessories_included} {asking_price} {sale_price} {sku}
{photos} — newline-joined URLs
{components} — bulleted list from `bike_components` join (category: brand model)
{title} — `{year} {make} {model}` convenience
```

Renderer: simple `body.replace(/\{(\w+)\}/g, ...)`. Missing fields render as empty string. Booleans render as `Yes`/`No`. Currency fields formatted as `£X`.

### 4. Bike detail — Copy Template button
File: `src/components/bike/BikeDetailView.tsx`. Add a `DropdownMenu` button "Copy listing" next to existing actions with one item per platform that has a saved template. On click:
- Fetch the template, render with the current bike (+ components already loaded in view)
- For HTML format: write both `text/html` and `text/plain` to clipboard via `navigator.clipboard.write([new ClipboardItem(...)])`
- For text format: `navigator.clipboard.writeText(...)`
- Toast "Copied eBay listing"

### Technical notes
- Templates cached per session with a simple `useQuery`-less fetch on dropdown open (only 4 rows max).
- Shared helper `src/lib/listingTemplate.ts` exports `renderTemplate(bike, components, body)` and `LISTING_FIELDS` metadata, reused by Settings preview and BikeDetailView.
- Out of scope: posting directly to platforms, image upload to eBay/Shopify, per-bike template overrides.
