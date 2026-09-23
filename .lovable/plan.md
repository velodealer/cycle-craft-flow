# Audit: how fitted parts are stored and shown (findings only, no changes)

Everything below comes from read-only queries against the live database and from reading the code. Where something is uncertain, it says so.

## 1. Schema

### Tables involved
There are **four stores of spec data**, plus columns on `bikes`:

| Store | Role |
|---|---|
| `components` | Shared **parts library** for each business: one row per distinct part |
| `bike_components` | Links a bike to a library part in a named slot |
| `component_categories` | Global lookup (30 rows); only `components.category_id` points to it |
| `bikes.spec_values` (jsonb) | Section/field spec tree (frame, fork, drivetrain…) |
| `bikes.catalog_data` (jsonb) | Full raw 99spokes record for the bike |
| `catalog_bikes` | Global cache of 99spokes models (8 rows) |

**`components`**
- `id uuid` pk, default `gen_random_uuid()`
- `category_id uuid` not null, FK to `component_categories` ON DELETE RESTRICT
- `brand text` not null; `model text` not null; `mpn text` null; `description text` null
- `weight_g numeric` null; `attributes jsonb` not null, default `'{}'`
- `business_id uuid` not null, default `current_business_id()`, FK to `businesses`
- `created_at`, `updated_at`
- Unique index `components_category_brand_model_mpn_uk (category_id, brand, model, coalesce(mpn,''))`; index `components_category_idx`
- No updated_at trigger found on this table.

**`bike_components`**
- `id` pk
- `bike_id` not null, FK to `bikes` ON DELETE CASCADE
- `component_id` not null, FK to `components` ON DELETE RESTRICT
- `slot text` not null; `position text` null; `notes text` null
- `business_id` not null, default `current_business_id()`; `created_at`
- **Unique `bike_components_slot_uk (bike_id, slot)`**; index on `bike_id`

**`component_categories`**: `id`, `slug` (unique), `name`, `sort_order`, `created_at`.

**`catalog_bikes`**
- `source` (default `'99spokes'`), `source_id`, unique on `(source, source_id)`
- `brand`, `model`, `family`, `year`, `category`, `subcategory`, `bike_type`, `is_ebike`, `thumbnail_url`, `url`
- jsonb columns: `sizes`, `spec`, `bike_fields`, `components`, `raw`
- `use_count`, `created_by`, timestamps
- Indexes on `lower(brand), lower(model)` and on `year`

**Spec columns on `bikes`**
- Plain columns: `make`, `model`, `year`, `size`, `colour`, `bike_type`, `gender`, `frame_material`, `weight_kg`, `mpn`, `accessories_included`, `condition`, `condition_notes`
- Flags: `has_*` and `is_electric`
- jsonb: `spec_values` (not null)
- 99spokes: `catalog_source`, `catalog_source_id`, `catalog_size`, `catalog_data`, `catalog_synced_at`

### Where brand, model, part number and free text live
- **Brand, model and part number:** `components.brand`, `components.model` and `components.mpn`.
- **Free text:**
  - `components.description`, which is shared across every bike using that part
  - `bike_components.notes`, which is per bike (99spokes writes the bike-specific description here)
- **Structured extras:** `components.attributes`.

### How a part is tied to a bike, and front/rear
- A part is tied to a bike through `bike_components`, with one row per `(bike_id, slot)`.
- Two of the same kind work by using **different slot strings**: `front_tyre`/`rear_tyre`, `front_hub`/`rear_hub`. `position` is also set (`front`/`rear`); in the data only tyres and hubs use it.
- A bike can't hold two rows in the same slot, e.g. two `accessories`.

### Slots
Slots are **free strings**. There is no enum and no FK. Two separate vocabularies exist:
- **Categories (30):** frame, fork, headset, rear_shock, wheels, hubs, spokes, tyres, crank, power_meter, cassette, chain, front_derailleur, rear_derailleur, shifters, bottom_bracket, brakes, rotors, brake_levers, handlebars, stem, grips, saddle, seatpost, pedals, ebike_system, ebike_battery, ebike_display, ebike_charger, accessories.
- **Slots (defined in code in `src/lib/bikeSpec.ts` and the `push()` calls in `src/lib/spokes.ts`):** frame, fork, rear_shock, headset, wheelset, front_hub, rear_hub, spokes, front_tyre, rear_tyre, crank, power_meter, cassette, chain, front_derailleur, rear_derailleur, shifters, bottom_bracket, brakes, brake_levers, disc_rotors, handlebars, stem, grips, saddle, seatpost, pedals, ebike_system, ebike_battery, ebike_display, ebike_charger, mudguards, rack, lights, bell, kickstand, lock.
- Slot and category names differ in places: `wheelset`→`wheels`, `disc_rotors`→`rotors`, `front_tyre`→`tyres`, and accessories collapse into one category.

### Access rules (RLS)
- **`components` and `bike_components`:**
  - Permissive rules: "manageable/readable by authenticated" (`true`) and "customer service can manage".
  - A **RESTRICTIVE** `tenant_scope` rule (`business_id = current_business_id()` and business active, or super admin).
  - Net effect: each business sees and edits only its own rows.
- **`component_categories`:** read-only for signed-in users.
- **`catalog_bikes`:**
  - Any signed-in user can read, add and update (shared across dealers, no tenant scope). Only admins can delete.
  - Worth noting: one dealer can edit a cached model that other dealers use.

### Example jsonb payloads (no customer data)
- `components.attributes`:
  - `{"shellWidthMM":79,"standard":"BBRight","threaded":false}` (SRAM DUB bottom bracket)
  - `{"width":"25c"}` (tyre)
  - `{"material":"carbon","innerWidthMM":35}` (wheelset)
- `bikes.spec_values` (Trek, BPS-TRE-027T):
  `{"drivetrain":{"groupset":"Shimano 105 Di2","chainring":"Shimano 105","cassette_range":"Shimano 105","speed":12,"config":"2x","shifting":"electronic"},"frame":{"material":"Carbon","size":"60cm","bottom_bracket_standard":"T47","weight_limit_kg":125},"fork":{"material":"Carbon"},"wheels":{"wheel_size":"700c","rim_material":"Carbon","internal_width_mm":35,"configuration":"same"},"brakes":{"type":"Hydraulic Disc"},"tyres":{"front_size":"25c","rear_size":"25c","max_clearance":"28c"},"cockpit":{"bar_material":"Aluminium"},"overview":{"spec_level":8}}`
- `bikes.catalog_data.components.rearDerailleur` (raw 99spokes):
  `{"maker":"Shimano","model":"105 Di2","display":"Shimano 105 Di2","description":"Shimano R7150 Di2, 36T max cog"}`

## 2. How data gets in

### 99spokes import
- **Path:** `spokes-lookup` edge function, then `mapSpokesBike()` and `upsertComponentsForBike()` in `src/lib/spokes.ts`. It runs from BikeForm and "Fill from 99spokes".
- **Field mapping:**
  - `maker` (or else display/description) → `brand`
  - `model` (or else display/description) → `model`
  - `partNumber`/`mpn`/`sku`, or a regex-derived part number → `mpn`
  - Other keys → `attributes`, plus regex extractions from `parseSpecFromText()` (max cog, gear range, speeds, chainrings, crank length, rotor size, widths)
  - The description → both `components.description` (only if blank) and `bike_components.notes`
- **Raw payload:** kept in full in `bikes.catalog_data` and in `catalog_bikes.raw`.
- **Matching parts:** it looks up an existing library part by **category + brand + model (case-insensitive), ignoring mpn**.
  - So every "Shimano 105" cassette on every bike points at **one shared row**.
  - The first import's description and attributes win; later imports only fill blanks.
- **Re-import:** the bike's slot link is overwritten (`upsert onConflict bike_id,slot`). The library part is merged with blanks-only, and the per-bike `notes` are overwritten.
- **Where brand is missing from 99spokes** (frame, fork, seatpost), the whole description becomes both brand and model (see section 4).

### Manual entry
- **`BikeSpecificationSection.tsx`:** the `spec_values` fields per section, plus choosing a library part for each slot via `ComponentPicker.tsx`, plus per-bike notes.
- **`ComponentForm.tsx`** (Components page): category, brand, model, mpn, description, weight_g. Attributes are shown read-only.
- **BikeForm:** the plain `bikes` columns only, plus the 99spokes lookup.

### Other writers
- **`BreakBikeDialog.tsx` / `StripComponentDialog.tsx`:** turn fitted parts into stock parts and delete links.
- **`delete-bike` and `reverse-sale` edge functions:** delete links.
- **"Re-scan details" (ComponentsPage):** fills blank `attributes`/`mpn` from descriptions.
- **Not found:** CSV/bulk import, eBay or Shopify import, triggers, webhooks or cron jobs that write parts.

## 3. How data gets out

### Listing template renderer
- **Where it lives:** `src/lib/listingTemplate.ts` (preview) and `supabase/functions/_shared/listing-template.ts` (used by eBay, Shopify and Squarespace). They are near-identical copies.
- **Bike placeholders:** title, make, model, year, colour, size, gender, bike_type, frame_material, frame_number, mpn, serial_number, condition, condition_notes, description, listing_description, weight_kg, is_electric, has_suspension_fork, has_rear_shock, has_dropper, accessories_included, asking_price, sale_price, sku, reference, photos.
- **Spec placeholders:** `spec_<section>_<field>` for every `spec_values` entry.
- **Part placeholders:** `part_<slot>` and `part_<slot>_detail`.
- **Blocks:**
  - `{components}`: `• <category>: <brand model>` for each part
  - `{components_table}`: `<tr><th>label</th><td>brand model<br><small>detail</small></td></tr>`
  - `{spec_list}` / `{spec_table}`: every `spec_values` entry as "Section field: value"
- **`part_<slot>`** = `brand + ' ' + model`.
- **`part_<slot>_detail`** = `description · MPN: x · weight g · attributes · notes`.
  - The shared `description` and the per-bike `notes` are usually the same text, so it appears twice.
- **Empty values:** unknown or empty tokens render as `''`. The template never prints "N/A" itself.

### eBay item specifics and title
- `_shared/ebay-aspects.ts` and `ebay-title.ts` read the **bike's own details and `spec_values` only, never `bike_components`**.
- So "Groupset: Shimano 105" comes from `spec_values.drivetrain.groupset`, not the parts.

### Shopify metafields
- Shopify metafields come only from the dealer's field mapping (`listing_templates.field_map`, `namespace.key` rows).
- **Right now no Shopify mapping is saved.** The only saved format is eBay, with `field_map = []`. So no metafields are written today.
- The starter set would add `bike.brand/model/year/size/colour/frame_material/wheel_size/groupset/bike_type/condition/electric`, all from bike details or spec, none from parts.

### Public bike table and partner access
- There is **no public bike table on velodealer.com**. Public pages are marketing, blog, careers and legal.
- The staff Bikes list searches and filters on bike details only (make, model, frame, serial, reference; status, source, location, size) and doesn't read parts.
- **Partners:**
  - InspectABike receives make, model, year, frame number and type only.
  - Cycle Courier receives no spec.
  - No public API exposes spec.

## 4. Data quality (live numbers)

**Overall**
- Bikes: **83** in total, 20 ready to list (0 listed), 2 sold.
- Only **9 bikes (10.8%) have any fitted parts**. Among the 20 ready bikes, **2 have parts and 2 have `spec_values`**.
- 3 bikes came from 99spokes (`catalog_source`), 3 have raw `catalog_data`, 9 have `spec_values`.
- Library: **113 parts, 145 links**. 21 parts are shared by more than one bike; 9 aren't fitted to any bike.
- Library completeness: `mpn` filled on 5 parts (4%), `attributes` on 25 (22%), `description` on 103, **`weight_g` on 0**.
- Whether a part row came from 99spokes or was typed in is **not tracked** on `components`. Only the bike-level `catalog_source` exists.

**Fill rate per slot (share of all 83 bikes)**

| Slots | Share |
|---|---|
| wheelset | 10.8% |
| brakes, cassette, chain, crank, bottom_bracket, fork, front/rear derailleur, front/rear tyre, handlebars, saddle, seatpost, shifters, stem | 9.6% each |
| frame | 3.6% |
| grips, disc_rotors, pedals | 2.4% |
| hubs, spokes, headset, brake_levers, mudguards, ebike_battery | 1.2% |

**How cleanly brand, model and part number are split**
- Brand and model only match the pattern "brand = maker, model = family" on the drivetrain slots (Shimano / 105, SRAM / Rival).
- The whole description sits in `model`, with `brand` set to its first word, for:
  - fork: 7 of 8
  - seatpost: 8 of 8
  - frame: 3 of 3
  - handlebars/stem/saddle: mostly
- Examples:
  - brand `Ultralight`, model `Ultralight 500 Series OCLV Carbon, Ride Tuned…`
  - brand `Size:`, model `Size: 47, 50, 52, 54, Bontrager carbon seatmast…`
  - brand `Advanced-grade`
  - brand `Cerv√©lo` (a broken character encoding)
- For tyres (8 of 8) and bottom brackets (6 of 8), `brand = model`, e.g. `Vittoria / Vittoria`.
- Part numbers exist almost only inside the free text (`BR-R7170`, `R7150`, `R7170`, `R7100`, `7101`, `RT70`). Only 5 rows have `mpn` filled.

**Most common raw values (brand / model / start of description)**
- **brakes:**
  - Shimano/Ultegra "Front: Shimano Ultegra, Hydraulic…" (×4)
  - Shimano/105 "BR-R7170 flat mount…"
  - Giant/Giant "GRX RX-400… rotors 160mm" (mpn RX-400)
  - SRAM/Force; SRAM/Rival "PaceLine rotors 160/140"
- **cassette:** Shimano/Ultegra "11-speed, 11-34t" (×4); Shimano/105 "7101, 11-34, 12 speed" (×2); SRAM/Force "XG-1270, 10-28"; SRAM/Rival "10x36"
- **crank:**
  - Shimano/Ultegra "R8000, 50/34T" (×3)
  - Giant/Giant "Ultegra 36/52 + power meter"
  - FSA/FSA "Omega AGX 32/48"
  - Shimano/105 "Size: 47… R7100 50/34 165mm…"
  - SRAM/Force; SRAM/Rival
- **fork:** Advanced-grade/… (×2), Cervélo/…, Émonda/…, Specialized/Future Shock 1.5, S-Works/…
- **frame:** Carbon/Carbon fiber; Ultralight/…OCLV…; Advanced-Grade/…
- **front_derailleur:** Shimano/Ultegra Di2 (×3), SRAM/Rival AXS, Shimano/Ultegra, SRAM/Force eTap, Shimano/105 Di2, Shimano/GRX 800 (mpn RX-810)
- **handlebars:** Giant/Giant "Contact SL S:40cm…" (×3), Bontrager/Bontrager, Cervélo AB07, S-Works Aerofly II, Specialized Hover
- **rear_derailleur, shifters, stem, seatpost, saddle, wheelset:** the same pattern as above.
  - Drivetrain parts have a clean brand/family.
  - Cockpit parts are brand-only with the text in the description, e.g. Bontrager/Bontrager "Aeolus Comp, steel rails".
- The full top-10 list was truncated in the query output. The lines above cover every distinct value I saw; there are only 3–9 rows per slot.

**Data errors spotted on BPS-TRE-027T**
- **Chain** is linked to "Shimano SLX M7100".
- **"Shimano BT-DN300"** (a Di2 battery) is filed under `ebike_battery`.
- **Cassette** attributes say `speeds: 11` while its text says 12 speed.
- **Likely cause:**
  - The battery is probably 99spokes' own `battery` field mapped to the e-bike slot.
  - The cassette mismatch is consistent with the shared-row merge above.
  - I haven't confirmed where the SLX chain came from.

## 5. Gaps in today's Trek listing

| Gap | Verdict |
|---|---|
| Frame model / OCLV 500 grade | **In the database, not rendered cleanly**: it's inside `model`/notes as one long string; the raw data has no separate model or grade field |
| Fork brand/model | **In the database only as text** ("Émonda SL full carbon…"); no brand field from 99spokes |
| Shifters, derailleurs, crank, cassette, chain, bottom bracket | **In the database** (all linked on this bike). **Not rendered** unless the template uses `{part_*}`, `{components}` or `{components_table}`. Your template uses `spec_*` tokens for drivetrain |
| Part numbers ST-R7170, RD-R7150, FC-R7100, CS-R7101 | **In the database, inside text only** (`R7170`, `R7150`, `R7100`, `7101`). `mpn` is empty; parts were imported before the parser and re-imports only fill blanks. Shimano's prefixes (ST-, RD-, FC-, CS-) are **not in 99spokes' text**, so they'd have to be inferred |
| Crank length | **In the database as text only**, per size ("…172.5mm length" for 54–58, 175mm for 60/62); not split out per size |
| Chainrings / cassette range show "Shimano 105" | **A mapping bug**: `spec_values.drivetrain.chainring` and `cassette_range` hold the groupset name; the real 50/34 and 11-34 are in the part text and raw data |
| Brake caliper model/part number, rotors | **In the database**: brakes text has BR-R7170; the `disc_rotors` part "Shimano RT70, centerlock, 160mm" exists. **Not rendered** by your template |
| Wheelset brand/model, hubs, spokes | Wheelset **in the database** (Bontrager / Aeolus Elite, text includes 35mm depth, OCLV, axles) but not rendered. Hubs and spokes **missing** for this bike (99spokes didn't send them) |
| Tyres | **In the database** (Bontrager R2 Hard-Case Lite 700x25), not rendered |
| Handlebars, stem, seatpost, saddle | **In the database** (all four linked), not rendered by your template; seatpost and stem are stored as messy per-size text |
| "Also included: N/A" | **The value is stored as "N/A"**: 22 bikes have the literal `N/A` and 20 have `None`. The template has an unconditional `<div>` row; the renderer can't hide a row, it only blanks tokens |
| All the above, in the parts UI | Visible on the bike's specification tab and the Components page, so they are **exposed in the UI**, just not split into clean fields |

## 6. My read

**Fit for purpose, keep:**
- The `components` + `bike_components` design (a shared library plus per-bike link with position and notes)
- The RESTRICTIVE tenant scoping
- The raw payload kept in `catalog_data`
- The placeholder system and `part_<slot>` tokens
- The field-mapping approach for Shopify and Squarespace

**The real problems are:**
1. Library parts are matched on brand + model while ignoring the part number, so bikes share one description and attributes.
2. The brand/model split fails whenever 99spokes has no `maker`/`model`.
3. `mpn` isn't filled on existing rows.
4. There's no conditional/empty-row handling in templates.
5. eBay specifics and `spec_values` never read the parts.

**Minimum change to get brand + model + part number stored and shown everywhere:**
- No restructure needed. The columns already exist.
- Fixes needed:
  - the import logic (match on part number; parse brand/model from text when missing; don't write the groupset into chainring/cassette_range)
  - a backfill from `catalog_data`
  - template rendering (clean `part_*` tokens, a `{part_<slot>_mpn}` token, empty-row hiding)

**What would break if the part shape changed:**
- `partTokens`/`buildValues` in both template copies
- `BikeSpecificationSection` and `ComponentPicker` joins (`components(brand, model, mpn, weight_g, description, attributes)`)
- `BreakBikeDialog`/`StripComponentDialog` (turn parts into stock parts)
- `delete-bike`, `reverse-sale`
- saved dealer templates that use `{part_*}` tokens
- The Shopify/Squarespace field mappings don't reference parts today.
- No partner API or saved views depend on them.

**Migration risk:**
- Small dataset: 113 parts, 145 links, 9 bikes.
- Splitting shared rows or backfilling `mpn` is reversible if old values are copied into a backup column/table first.
- Changing the unique key or making slots an enum/FK is harder to reverse. It would need the slot/category mismatch mapped first.

## Options

**A. Minimal (import + render fixes, no schema change)**
- **Import:**
  - Match library parts on brand + model + mpn.
  - Derive brand/model from text when 99spokes lacks `maker`.
  - Fill `mpn`, and add Shimano prefixes by slot (ST-/RD-/FD-/FC-/CS-/BR-).
  - Stop writing the groupset into chainring/cassette_range.
  - Parse tooth counts, crank length and rotor sizes into `spec_values`.
- **Backfill** the 9 bikes from `catalog_data`.
- **Renderer:**
  - `part_<slot>` without duplicate text; new `part_<slot>_mpn` / `_brand` / `_model` tokens.
  - Treat `N/A`/`None`/blank as empty, and hide `<tr>`/`<div class="r">` rows whose value is empty.
- **eBay:** item specifics fall back to parts (Groupset, Brake Type, Wheel brand).
- **Trade-off:** fastest and lowest risk. Shared library rows still hold one description for many bikes (per-bike notes cover the difference).

**B. Moderate (A + a few columns)**
- Add a per-bike override on `bike_components`: `brand`, `model`, `mpn`, `attributes`. These win over the library row.
- Add `components.source` (`99spokes`/`manual`) and a raw snippet.
- Add a `slot` lookup table mapping slot → category (fixes the mismatch).
- Backfill with a backup table.
- **Trade-off:** clean per-bike accuracy (crank length per size, a different saddle fitted) without breaking current readers, since overrides fall back to the library. There's a moderate amount of code to update in both template copies and the spec UI.

**C. Full restructure**
- Drop the shared library for fitted parts: `bike_components` holds brand/model/mpn/attributes directly; `components` becomes an optional catalogue.
- Slots become an enum or FK with front/rear as a real `position`, allowing several accessories.
- Separate `spec_values` sections are derived from parts.
- **Trade-off:** the cleanest model. But it rewrites the picker, break/strip flows, templates, backfill and RLS, is the hardest to reverse, and is the most effort for 9 bikes' worth of data today.

**Recommendation: A now, with B's per-bike override columns added when the first real "same part, different spec" case appears.** Almost every gap in the Trek listing is data we already hold, lost in the import split or not rendered, so A fixes what buyers see without touching the schema.
