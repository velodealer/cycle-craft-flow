# Bike spec lookup from the open bicycle brands & models dataset

Replace the Bike Index idea with the `reaatech/bicycle-brands-models` open dataset (MIT licensed, 545 brands, ~4.6 MB total, structured brand → models → sizes). It has no API key, no rate limits, and covers exactly the fields the Add Bike form needs.

## What the user gets

In the Add/Edit Bike form, a new "Look up bike" panel at the top of the Bike Details section:

- **Brand** — searchable dropdown of all 545 brands (type to filter).
- **Model** — searchable dropdown of that brand's models, loaded once a brand is picked. Shows the model name plus its category (Road, Gravel, Mountain, eBike) so near-identical trims are distinguishable.
- **Size** — dropdown of the sizes recorded for that model (e.g. `M — 56 cm, rider 174–184 cm`). Optional.
- **Apply** fills in Make, Model and Size on the form. Category, e-bike flag and suspension are appended as a short line in the Description field if it's empty. Nothing is overwritten silently — fields the user already typed are left alone unless they confirm the overwrite prompt.
- Everything stays free-text: if a bike isn't in the dataset, the user just types as they do today.

## Technical approach

**Data delivery** — do not vendor 4.6 MB into the repo. Instead:
- Commit a generated `src/data/bikeBrands.json` index: `[{ name, slug }]` for all 545 brands (~15 KB). Generated once by a script reading the GitHub tree listing.
- Fetch individual brand files on demand from jsDelivr: `https://cdn.jsdelivr.net/gh/reaatech/bicycle-brands-models@main/brands/<slug>.json` (verified 200, CORS-enabled, CDN-cached). Cache fetched brands in an in-memory `Map` for the session.

**New files**
- `src/data/bikeBrands.json` — brand index.
- `src/lib/bikeCatalog.ts` — types (`CatalogBrand`, `CatalogModel`, `CatalogSize`), `loadBrandModels(slug)` with in-memory cache and error handling, and a helper that formats a size label.
- `src/components/management/BikeCatalogLookup.tsx` — the lookup panel: three shadcn `Command`/`Popover` comboboxes (brand, model, size), loading and empty states, and an `onApply(values)` callback.

**Changed file**
- `src/components/management/BikeForm.tsx` — render `BikeCatalogLookup` inside the Bike Details card; on apply, `form.setValue` for `make`, `model`, `size` (and `description` when blank). No schema or database changes.

**Notes**
- Offline/failed fetch: the panel shows "Catalog unavailable — enter details manually" and the form works unchanged.
- Model lists can be large (a few thousand for big brands); the model combobox virtualises nothing but filters as you type, which is fine for these sizes.
- Attribution comment referencing the MIT-licensed source dataset in `bikeCatalog.ts`.
