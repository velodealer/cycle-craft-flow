## Save, edit & version quotes

Extend the Quote Builder so quotes are stored in Supabase, can be reopened and edited later, and every save creates an immutable snapshot for auditing.

### Data model (migration)

Two new tables in `public`:

**`quotes`** — the current/editable state of each quote
- `name` (text, required — e.g. "Custom Enve build for J. Smith")
- `notes` (text, optional)
- `sale_price` (numeric)
- `rows` (jsonb — array of `{description, category, qty, unitCost}`)
- `total_cost` (numeric, generated from rows on save)
- `current_version` (int, default 1)
- `created_by` (uuid → profiles.user_id)
- `created_at`, `updated_at`

**`quote_versions`** — immutable audit trail, one row per save
- `quote_id` (uuid → quotes.id, cascade)
- `version` (int)
- `name`, `notes`, `sale_price`, `rows` (jsonb), `total_cost`
- `saved_by` (uuid), `saved_at`
- Unique on `(quote_id, version)`

RLS: admin/mechanic/accountant/owner can read all quotes; creators + admin can update/delete their quotes; versions are insert-only from the app and readable by the same roles. Standard GRANTs for `authenticated` + `service_role`. `updated_at` trigger on `quotes`.

### UI changes

**`/quote-builder`** (list view)
- Replace the single calculator with a list page showing saved quotes: name, total cost, sale price, margin, last updated, author.
- "New quote" button → `/quote-builder/new`.
- Row click → `/quote-builder/:id`.

**`/quote-builder/:id` / `/new`** (editor)
- Existing calculator UI (rows, sale price, live metrics), plus:
  - Name + notes fields at the top.
  - "Save" button — on first save inserts into `quotes` + writes version 1 to `quote_versions`. On subsequent saves updates `quotes`, increments `current_version`, and inserts a new `quote_versions` row.
  - "History" panel (collapsible side sheet) listing every version with saved_at + author. Selecting a version shows a read-only diff-style view and offers "Restore this version" (which loads the values into the editor; user still has to Save to create a new version — keeps history append-only).
  - Unsaved-changes indicator + confirm-on-leave.

### Files

New:
- `src/pages/QuoteListPage.tsx` — index list.
- `src/pages/QuoteEditorPage.tsx` — replaces most of the current `QuoteBuilderPage` logic, handles both new + existing.
- `src/components/quotes/QuoteHistoryPanel.tsx` — version list + restore.
- `src/hooks/useQuote.ts` — load/save/version helpers.

Edited:
- `src/pages/QuoteBuilderPage.tsx` — becomes a thin wrapper or is replaced by the list page.
- `src/App.tsx` — routes: `/quote-builder` (list), `/quote-builder/new`, `/quote-builder/:id`.
- Sidebar entry unchanged.

### Technical notes

- Rows stored as JSONB keeps the schema flexible and matches the current in-memory shape — no per-row table needed for an auditing use case.
- Versions are written client-side in the same transaction-style flow (update quote → insert version). Acceptable because `quote_versions` is append-only and RLS forbids updates/deletes on it.
- "Restore" never rewrites history; it just repopulates the editor, so the audit trail stays intact.
