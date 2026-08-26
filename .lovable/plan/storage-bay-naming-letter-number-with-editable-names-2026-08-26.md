# Storage Bay Naming: Letter + Number with Editable Names

## Goal
Make it easy to create storage bays that follow a letter-and-number pattern (e.g., A1 through A20) while keeping the generated names editable afterwards.

## Proposed changes

### 1. Bulk bay generator in Settings
Add a new block in `src/components/settings/StorageBays.tsx` that lets the user:
- Enter a prefix letter (e.g., `A`, `B`, `M`).
- Enter a start number and an end number (e.g., 1 → 20).
- Optionally assign a zone to the whole batch.
- Click a single "Generate bays" button to create all bays in one go.

This avoids having to add 20 bays individually. Each generated bay will be stored as a normal row in `storage_bays` with `name` set to the letter + number pattern.

### 2. Keep existing inline editing
The current editable list will remain unchanged: users can still rename any generated bay, change its zone, activate/deactivate, or delete it. Generated names are only a starting point.

### 3. Natural sorting for letter + number names
Update `src/hooks/useStorageBays.ts` so bays sort naturally: `A1, A2, A10` instead of lexicographically `A1, A10, A2`. This will use the existing `sort_order` column when set, and fall back to a natural-alpha sort on `name` otherwise.

### 4. Small UI quality-of-life touches
- Add a placeholder example in the prefix input (e.g., "A").
- Validate that the prefix is a single letter and numbers are positive integers before generating.
- If a generated name already exists, skip duplicates and warn rather than failing the whole batch.

## Files affected
- `src/components/settings/StorageBays.tsx` — add batch generator and duplicate handling.
- `src/hooks/useStorageBays.ts` — natural sorting on `name`.
- `src/components/bike/LocationSelect.tsx` — inherits sort order automatically from the hook.

## Not in scope
- Hardcoding the format or preventing free-text names (editable requirement means names stay flexible).
- Adding a new database column; the existing `name` column is sufficient.
