## Ensure HTML templates copy as HTML

When a template's `format` is `html`, `copyListing` in `src/lib/listingTemplate.ts` should reliably place rich HTML on the clipboard so pasting into eBay/Shopify/Gmail/etc. preserves formatting (headings, lists, line breaks), not raw `<h2>…</h2>` source.

### Problem
Current `copyListing` does call `navigator.clipboard.write` with a `text/html` blob, but:
- The `text/plain` fallback is built by stripping tags (`rendered.replace(/<[^>]+>/g, '')`), which collapses block-level breaks into one run-on line — apps that prefer `text/plain` then show garbage.
- If `ClipboardItem` or `navigator.clipboard.write` isn't available (older Safari, insecure context), it silently falls back to `writeText(rendered)` which pastes raw HTML source.
- No explicit signal in the success toast that HTML was copied, so the user can't tell what landed on the clipboard.

### Changes (single file: `src/lib/listingTemplate.ts`)

1. **Better plain-text fallback** — convert HTML to readable plain text before putting it in the `text/plain` blob:
   - Replace `<br>` and closing block tags (`</p>`, `</div>`, `</li>`, `</h1-6>`) with `\n`
   - Add `• ` prefix for `<li>`
   - Strip remaining tags, decode basic entities (`&amp; &lt; &gt; &nbsp; &#39; &quot;`)
   - Collapse 3+ newlines to 2

2. **Real HTML copy with execCommand fallback** — if `ClipboardItem` path throws or is unsupported, fall back to a hidden `contenteditable` div containing the rendered HTML, `document.execCommand('copy')` on a selection of it. Only if that also fails, fall back to `writeText`.

3. **Return format info** — `copyListing` returns `{ ok, format, reason? }` so `BikeDetailView` can toast `"Copied eBay listing (HTML)"` vs `"…(plain text)"`.

4. **BikeDetailView toast** — update the existing toast to use the returned `format`.

### Out of scope
- No DB or settings UI changes.
- No change to how `format` is stored or rendered in the preview.
