# Expand the component popup

## Goal
Make every manufacturer detail visible and editable when adding or editing a component, including category-specific values such as material, speeds, axle, rim depth, tyre size, travel, compatibility and any other details supplied by 99Spokes.

## Changes
- Keep the existing core fields: category, brand, model, manufacturer part number, weight and description.
- Replace the current read-only manufacturer-details display with an editable key/value section.
- Load every existing manufacturer-detail entry when editing, without dropping unfamiliar or future fields.
- Allow users to add and remove detail rows when creating or editing a component.
- Preserve useful value types where possible, including text, numbers, yes/no values and lists, rather than flattening all imported data unnecessarily.
- Save the complete manufacturer-details set with the component while leaving internal fields such as dealership ownership, import source, confidence and timestamps hidden.
- Make the expanded popup scroll within the screen, with Save and Cancel remaining accessible on mobile and desktop.
- Apply the same form wherever “New component” or “Edit component” is opened, including from a bike’s component picker and the component library.

## Validation
- Require a name for each populated manufacturer-detail row and prevent duplicate detail names.
- Keep category, brand and model required; reject invalid weights cleanly.
- Verify creating a component with manufacturer details, reopening it, changing details and saving again preserves the full set.
- Check the popup at the supplied mobile size and on desktop, then confirm the preview build remains clean.

## Technical details
- Extend the shared component record/form state to include the existing `attributes` object.
- Use a reusable editable attribute-row control and serialize it back into `components.attributes` on insert/update.
- No database migration is needed because manufacturer details already have a dedicated stored object.
