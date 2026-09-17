# Add a size filter to the bikes list

## What changes

### Size filter on Bike Management (`src/components/management/BikeList.tsx`)
- Add a "Filter by size" dropdown next to the existing status / source / location filters (full width on mobile, fixed width on desktop like the others).
- The options are built from the sizes actually saved on your bikes, so the list only ever shows real choices, plus:
  - **All Sizes** (default)
  - **Not recorded** (bikes with no size)
- Because sizes have been entered in mixed formats over time (`54cm`, `54`, `M - 54`, `Large`, `L - 56`), picking a size matches smartly rather than exact-text only:
  - Sizes containing a number match on that number — choosing `54cm` also catches `54`, `R054`, `M - 54`.
  - Letter sizes (XS, S, M, L, XL, 2XS…) match their word forms too — choosing `M` also catches `Medium`; `L` catches `Large` and `LG`.
- The filter works together with the search box and the status/source/location filters, and the "Bikes (n)" count and label printing follow it.

### Optional tidy-up (not included unless you ask)
- Standardising the size values already stored on bikes (e.g. turning `Large - 58cm` into one format) is a separate data clean-up — say the word and I'll plan it.

## Technical details
- One file changed: `src/components/management/BikeList.tsx`.
- New `sizeFilter` state (default `'all'`); distinct size list derived from the loaded bikes; filtering done in the existing `filteredBikes` memo with a small normaliser (extracts the cm number or letter size, lowercase-compares word forms).
- No database or API changes; sizes load with the bikes already being fetched.
