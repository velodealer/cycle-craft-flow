# Fix: catalog dropdowns not scrollable (mobile)

The brand/model/size comboboxes in the bike lookup render hundreds of items, but the command list inside the popover has no enforced height or touch scrolling, so on mobile the list can't be scrolled and items off-screen are unreachable.

## Change (one file)

`src/components/management/BikeCatalogLookup.tsx` — for all three dropdowns:

1. Give `CommandList` an explicit scrollable height: `className="max-h-[280px] overflow-y-auto"` (styled `overscroll-behavior: contain` so page behind doesn't scroll instead).
2. Cap the `PopoverContent` height as well (`max-h-[320px] overflow-hidden`) so Radix doesn't stretch the popover past the viewport on small screens.
3. If the Radix Popover still swallows touch scroll, the same fix applies by switching content to `onTouchMove` propagation — will verify in the preview after the CSS fix and only add if needed.

## Verification

- Open Add Bike on a mobile-sized viewport, open the Model dropdown for a large brand (e.g. Specialized), confirm touch scroll works and items are selectable.
