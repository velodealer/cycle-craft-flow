# Print all labels in bulk

Add a "Print labels" button to the bike list pages so a whole batch can be printed in one go instead of opening each bike.

## Behaviour

- Button sits in the header of each list, next to the count, and prints every bike currently shown in that list (respecting the active search and filters).
- Opens the same full-screen label preview already used for a single bike, but showing all labels stacked, with a count in the header ("12 labels").
- Each label prints on its own 4x6 page (page break between labels), identical layout to the existing single label: brand, model, size, colour, reference and QR code.
- Selection: each list card/row gets a checkbox; when one or more bikes are ticked the button prints only those, otherwise it prints all shown. A "Select all" toggle sits next to the button.
- If the list is empty the button is disabled.

## Pages covered

- Bikes list (`BikeList`)
- Intake list
- Cleaning
- Inspection
- Logistics list

## Technical notes

- Extract the existing `LabelContent` from `src/components/bike/BikeLabel.tsx` into a shared export and add `src/components/bike/BikeLabels.tsx` accepting `bikes: Bike[]`, rendering one `LabelContent` per bike inside a print container with `break-after: page` and the same `@page { size: 4in 6in; margin: 0 }` rule.
- `BikeLabel` keeps its current single-bike API and simply delegates to the multi-label component with one item, so no existing call site changes.
- Small `useLabelSelection` state per page (a `Set<string>` of bike ids) driving the checkboxes; no database changes.
