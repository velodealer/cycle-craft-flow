# Mobile-friendly lists, bike photos, and storage bays

Make every list readable on a phone without horizontal scrolling, show the bike's main photo in the lists, and add a managed storage-bay location that can be changed at any time.

## Storage bays

- Admins manage bays in **Settings > Storage Bays**: add, rename, mark inactive, optional zone/notes.
- Every bike gets a **Location** field that picks from the active bay list (or "Unassigned").
- Location can be changed at any time from the bike detail page and inline from the Bikes, Intake, Cleaning and Inspection lists.
- Location is shown as a badge in each list, and lists get a "Filter by location" selector.

## List UI overhaul

Applies to Bikes, Intake, Cleaning, Inspection, Logistics, Parts, Components and Owners.

- On mobile (below `md`) the tables are replaced by stacked **cards** — one card per record, everything visible, no sideways scrolling.
- Bike cards show: main photo thumbnail (first intake photo, placeholder when none), make/model/year, status badge, location badge, frame number, and the row's actions as full-width buttons.
- Non-bike lists (parts, components, owners, logistics) use the same card pattern minus the photo.
- On tablet/desktop the existing tables stay, with a new thumbnail column on bike lists and a Location column.
- Tapping a card opens the same detail/dialog the current row action opens.

## Data

- New table `storage_bays`: name, zone, notes, is_active, sort order. Staff can read; admins manage.
- New column `bikes.storage_bay_id` referencing `storage_bays` (nullable, set null on bay delete).

## Technical notes

- New shared components: `src/components/ui/list-card.tsx` (mobile card shell) and `src/components/bike/BikeThumbnail.tsx` (reads `bike.photos[0]`, falls back to a bike icon).
- New `src/components/bike/LocationSelect.tsx` — bay dropdown that writes `storage_bay_id`; reused in list rows/cards and `BikeDetailView`.
- New `src/components/settings/StorageBays.tsx` plus a tab in `src/pages/SettingsPage.tsx`.
- Updated files: `BikeList.tsx`, `IntakePage.tsx`, `CleaningPage.tsx`, `InspectionPage.tsx`, `LogisticsList.tsx`, `PartList.tsx`, `ComponentList.tsx`, `OwnerList.tsx`, `BikeDetailView.tsx`, `BikeForm.tsx` (bay picker on create/edit).
- Bike queries add `photos` and `storage_bay_id` with a joined bay name; photos come from the existing public `bike-photos` bucket, so no new storage work.
- Cards use semantic tokens only; layout switches via `hidden md:block` / `md:hidden` so no JS breakpoint logic is needed.
