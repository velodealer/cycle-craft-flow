## Quote Builder — Preset rows & nested credit sub-lines

### 1. Pre-fill basic components on new quote
When starting a new quote, seed the rows list with 10 blank rows (qty 1, unit cost 0), one per category:

Frame, Seatpost, Stem, Handlebar, Groupset, Wheels, Tyres, Tubes, Saddle, Bar tape.

- Add matching entries to the `CATEGORIES` list in `QuoteBuilderPage.tsx` (currently missing "Bar tape", "Tubes" — the rest exist or map cleanly; "Wheels" replaces or joins "Wheelset").
- Editing an existing quote continues to load whatever rows were saved (unchanged).

### 2. Nested credit sub-lines under a bike row
Extend `QuoteRow` so any row can act as a **parent "bike"** with indented **child credit rows** beneath it. Child rows are entered as positive numbers but subtracted from the parent's effective cost and from the quote total.

Data model change in `src/lib/quotes.ts`:

```ts
export type QuoteRow = {
  id: string;
  description: string;
  category: string;
  qty: number;
  unitCost: number;
  parentId?: string | null;   // NEW — if set, this row is a credit under parentId
};
```

`computeTotalCost` becomes:

```text
total = Σ parent rows (qty × unitCost)  -  Σ child rows (qty × unitCost)
```

Backward compatible: existing saved rows have no `parentId`, behave as before.

### 3. UI in `QuoteBuilderPage.tsx`
- New "Deduct part from this" button on every parent row → inserts a child row directly beneath it with `parentId` set and category defaulted to "Wheels".
- Child rows render:
  - Indented (left padding), muted red text, minus-sign prefix on line total.
  - "Removed from: {parent description}" hint.
  - Cannot themselves have children (button hidden).
- Parent row shows an **effective cost** sub-line below its total: `£X (bike) − £Y (parts removed) = £Z`.
- Deleting a parent also deletes its children.
- "Add component" adds a new top-level row (unchanged).

### 4. History / versioning
No schema change needed — `rows` is `jsonb`. New `parentId` field is persisted transparently. Old versions restore as flat rows (no children), which is correct.

### Files to change
- `src/lib/quotes.ts` — add `parentId` to type, update `computeTotalCost` to subtract children.
- `src/pages/QuoteBuilderPage.tsx` — seed 10 preset rows, add "Bar tape"/"Tubes" to `CATEGORIES`, render nested UI, add/remove child logic, cascade delete.

No database migration required.
