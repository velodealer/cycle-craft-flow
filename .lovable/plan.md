## Copy HTML templates as raw HTML source

### Problem
When a template's format is `html`, the user pastes into eBay's HTML source editor (or similar). That editor reads `text/plain` from the clipboard and expects the literal markup. Today `copyListing` puts a stripped-tag version into `text/plain`, so the paste shows CSS content with no tags. The `text/html` payload is correct but most "HTML view" editors ignore it.

### Fix (single file: `src/lib/listingTemplate.ts`)

In `copyListing`, when `format === 'html'`:

- Put the **rendered HTML source verbatim** into `text/plain` (so HTML-source editors paste the markup as-is).
- Keep `text/html` set to the same rendered source (so rich-text editors like Gmail/Docs still render it).
- Drop the `htmlToPlain` tag-strip fallback for the HTML branch entirely — it was the source of the bad paste.
- `execCommand` fallback: write the raw source via a hidden `<textarea>` + `select()` + `execCommand('copy')` so the clipboard ends up with the source string (not a rendered DOM selection).
- Final fallback: `navigator.clipboard.writeText(rendered)` — also the raw source.

Text-format templates are unchanged: `writeText(rendered)`.

Toast wording stays as already implemented ("Rich HTML on clipboard" / "Plain text on clipboard"); both branches now actually deliver what they claim.

### Out of scope
- Removing `htmlToPlain` from the file (leave it; unused for now, may be useful later).
- Any settings/UI/DB changes.
