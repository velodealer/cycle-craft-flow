## Bike Specification System — Full Build Plan

A flexible spec system that works for every bike type (road, MTB, e-bike, cargo, kids, etc.) without hardcoding. Built in one pass.

### 1. Database

**New enum**
- `bike_condition` — `new`, `used`

**Extend `bikes` table** (additive, nullable so existing rows are fine)
- `bike_type`, `size`, `colour`, `gender`, `weight_kg`, `description`, `condition`, `frame_material`, `serial_number`, `barcode`, `sku`
- Section toggles: `has_rear_shock`, `is_electric`, `has_dropper`, `has_suspension_fork`, `has_accessories`
- `spec_values jsonb default '{}'` — free-form spec attributes (geometry, motor power, mileage, wear %, service notes, etc.)

**`component_categories`**
- `id`, `slug` (e.g. `frame`, `fork`, `wheels`…), `name`, `sort_order`
- Seeded with: Frame, Fork, Rear Shock, Wheels, Tyres, Drivetrain (crank, cassette, chain, derailleurs, shifters, BB), Brakes, Cockpit (bar, stem, grips), Saddle, Seatpost, Pedals, E-bike System, Accessories

**`components`** (global reusable library)
- `id`, `category_id`, `brand`, `model`, `mpn`, `description`, `weight_g`, `attributes jsonb`, `created_at`, `updated_at`
- Unique on `(brand, model, mpn)` (nulls distinct)

**`bike_components`** (join)
- `id`, `bike_id`, `component_id`, `slot` (e.g. `front_tyre`, `rear_derailleur`, `crank`), `position` (`front`/`rear`/`left`/`right`/null), `notes`, `created_at`
- Index on `bike_id`, unique on `(bike_id, slot)` when slot set

**RLS & grants** — same pattern as existing tables: authenticated full CRUD, service_role all. Categories readable by authenticated.

### 2. JSONB spec schema (per section)

Lives in `bikes.spec_values`. Documented as a TS type, not enforced in DB so new fields cost zero migrations. Top-level keys mirror the spec list provided: `frame`, `fork`, `rear_shock`, `wheels`, `tyres.front`, `tyres.rear`, `drivetrain`, `brakes`, `cockpit`, `saddle`, `seatpost`, `pedals`, `ebike`, `accessories`, `used`.

### 3. Components Library page (`/components`)

- List with search (brand/model/mpn), category filter, paging
- Create / edit / delete dialog (`ComponentForm`)
- Reachable from sidebar; reused as a picker

### 4. Bike Spec editor

New `BikeSpecificationSection` rendered on the bike detail page (`/bikes/:id`), grouped into collapsible `Accordion` panels:

1. General (type, size, colour, condition, frame material, serial, barcode, SKU, weight, description)
2. Frame
3. Fork *(hidden unless `has_suspension_fork` or type implies it)*
4. Rear Shock *(hidden unless `has_rear_shock`)*
5. Wheels
6. Tyres (front + rear)
7. Drivetrain (groupset, speed, 1x/2x/3x, crank, cassette, chain, derailleurs, shifters, BB)
8. Brakes
9. Cockpit (bars, stem, grips/tape)
10. Saddle & Seatpost (+ dropper if `has_dropper`)
11. Pedals
12. E-bike *(hidden unless `is_electric`)*
13. Accessories *(hidden unless `has_accessories`)*
14. Used-bike condition *(hidden unless `condition = used`)*

**Behaviour**
- Each component field is a searchable `ComponentPicker` (Command palette style) that lists global `components` filtered by category, with an inline "+ Create new component" that opens `ComponentForm` and selects the new record on save
- Selecting a component auto-fills brand/model display; saves the link in `bike_components` with the right `slot`
- Free-form fields (travel, sizes, geometry, motor power, mileage…) write into `spec_values` JSONB
- Section visibility driven by `bike_type` defaults + toggle flags (user can override)
- Single Save button per section; optimistic update + toast
- Read mode shows a clean spec sheet; Edit mode reveals inputs

### 5. Type defaults

A small `bikeTypeDefaults` map sets initial toggles when bike type changes:
- `mtb_full_sus` → `has_rear_shock`, `has_suspension_fork`, often `has_dropper`
- `road`, `gravel`, `cx`, `tt`, `track`, `bmx`, `kids`, `folding`, `hybrid`, `city`, `touring`, `tandem`, `recumbent` → no rear shock, no fork suspension (except hybrids optional)
- `cargo`, any `*_electric` variants → `is_electric`
User can still flip flags manually.

### 6. Files

**Created**
- `src/pages/ComponentsPage.tsx`
- `src/components/components/ComponentList.tsx`
- `src/components/components/ComponentForm.tsx`
- `src/components/components/ComponentPicker.tsx`
- `src/components/bike/spec/BikeSpecificationSection.tsx`
- `src/components/bike/spec/sections/*` (Frame, Fork, RearShock, Wheels, Tyres, Drivetrain, Brakes, Cockpit, SaddleSeatpost, Pedals, Ebike, Accessories, UsedCondition)
- `src/lib/bikeSpec.ts` — TS types for `spec_values`, slot constants, type-default map, helpers
- Supabase migration for enum, `bikes` columns, `component_categories`, `components`, `bike_components`, seeds, RLS, grants

**Edited**
- `src/components/bike/BikeDetailView.tsx` — mount `BikeSpecificationSection`
- `src/components/AppSidebar.tsx` — Components link
- `src/App.tsx` — `/components` route
- `src/components/management/BikeForm.tsx` — add the new top-level bike fields (type, size, condition, serial, barcode, SKU, toggles)

### 7. Out of scope (later)
- eBay / website export feeds
- Valuation reports from spec data
- Bulk import of component catalogues

Tell me to proceed and I'll implement everything in one go.