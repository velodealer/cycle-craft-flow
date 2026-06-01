# Fix: "owner_check" constraint error on consignment bikes

## Root cause

The `bikes.owner_check` DB constraint requires that any bike with `source = 'customer_consignment'` has either `owner_id` or `external_owner_id` set. `BikeForm` never captures an owner, so the insert fails.

## Changes (frontend only)

**`src/components/management/BikeForm.tsx`**
- Add `external_owner_id: z.string().uuid().optional()` to the schema, plus a `superRefine` that errors when `source === 'customer_consignment'` and no owner is selected.
- Load the list of `external_owners` (id, name, email) on mount.
- When `source === 'customer_consignment'`, render an "Owner" section below the Source field:
  - A `Select` listing existing external owners (name + email).
  - A "+ New owner" button that opens a nested `Dialog` containing the existing `OwnerForm`. On success, refresh the list and auto-select the new owner.
- Include `external_owner_id` in the `bikeData` insert/update payload. Pass `null` when source is `owned`.
- If the user toggles "Arrange collection", prefill the collection sender fields from the selected owner (name/email/phone/address) as a convenience — still editable.

No DB changes, no changes to other pages, no workflow changes.
