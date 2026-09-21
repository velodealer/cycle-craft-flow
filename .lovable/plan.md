# Bring in every component detail from 99spokes

Today, when a bike is filled from 99spokes we create parts for 20 slots only, and we keep just three things about each part: brand, model and a description line. Everything else the source publishes about that part — its material, widths, travel, speeds, size, position-specific text, and any new field they add — is discarded. Several parts the source sends aren't created at all.

## What changes

**1. Every part the source lists gets created**

Added on top of the current 20: front hub, rear hub, spokes, disc rotors, brake levers, headset, power meter, battery, display, charger, and the accessory parts (mudguards, rack, lights, bell, stand, lock). Frame is also recorded as a part. If the source later adds a part type we don't know, it still gets created under a general category rather than being dropped.

**2. Every detail on each part is kept**

For each part we store the full set of fields the source gives for it — material, widths, sizes, travel, speeds, capacity, power, weight, product code, and anything else — and show them on the part's page and in the bike's fitted-parts list. Product code and weight fill the existing MPN and weight boxes so search and labels work as they do for hand-entered parts.

**3. Front/rear differences are respected**

The source often describes a wheel, tyre or hub as "Front: X, Rear: Y". Where it does, we record the front and rear entries separately with their own text instead of one shared line.

**4. Existing parts get topped up, not overwritten**

When a part already exists in your library, we fill in blanks (missing product code, weight, details) but never overwrite something a person typed.

Bikes filled in before this change keep what they have; pressing "Fill from 99spokes" on a bike pulls the full part detail in.

## Technical notes

- `src/lib/spokes.ts`
  - `MappedComponent` gains `mpn`, `weightG`, `attributes` (the raw per-slot object minus maker/model/display) and keeps `description`.
  - `push()` reads any `partNumber`/`mpn`/`sku` and `weightG`/`weightGrams` fields and copies the rest of the slot object into `attributes`.
  - New slot mappings for `frontHub`, `rearHub`, `spokes`, `discRotors`, `brakeLevers`, `headset`, `battery`, `display`, `charger`, `powerMeter`, `frame`, `fenders`, `racks`, `lights`, `bell`, `stand`, `lock`, plus a catch-all pass over remaining `bike.components.*` keys into the `accessories` category with the key as the slot.
  - `splitFrontRear(description)` parses `Front: … , Rear: …` for `rims`, `tires`, hubs and rotors so each position carries its own description.
  - `upsertComponentsForBike()` writes `mpn`, `weight_g`, `attributes` on insert; on an existing component it patches only null/empty columns and merges `attributes` (existing keys win). Slot values outside the current `bike_components` slot list are allowed since `slot` is free text; the `bike_id,slot` conflict target still applies.
- Migration: insert the missing rows into `component_categories` (`headset`, `hubs`, `spokes`, `rotors`, `brake_levers`, `power_meter`, `ebike_battery`, `ebike_display`, `ebike_charger`) with sort orders; no schema change needed — `components.attributes`, `mpn`, `weight_g` already exist.
- Display: `ComponentForm` / `ComponentList` detail view and `BikeSpecificationSection`'s fitted-parts rows render `attributes` as a read-only key/value list (humanised keys), same styling as the manufacturer specification card.
- `saveCatalogBike` stores the richer `mapped.components` array as-is, so the local catalogue carries the same detail.
