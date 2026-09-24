# Add "Show more" to the 99spokes search results

## What this does

The bike lookup currently shows only the first 20 results from 99spokes for a search, with no way to see more. This adds a "Show more" button below the results list that fetches the next page of results for the same search and appends them, using 99spokes' built-in paging.

## Current state (verified)

- The lookup screen (`src/components/management/SpokesLookup.tsx`) calls `searchSpokesDetailed(term)` with the default limit of 20 and renders a flat list; there is no paging.
- The shared client (`searchSpokesDetailed` in `src/lib/spokes.ts`) passes only `query` and `limit` to the edge function and returns only `items`, `relaxed`, `droppedTerms`.
- The edge function (`supabase/functions/spokes-lookup/index.ts`, search action) calls 99spokes `GET /v1/bikes` with `q`, `queryMode=prefix`, `limit` (clamped 1–50) and `include`. When the typed phrase finds nothing it retries with a cleaned version, then progressively fewer words — the query that actually produced results is returned as `usedQuery`.
- 99spokes' `/v1/bikes` endpoint supports cursor paging (confirmed against their OpenAPI spec): pass `cursor=start` on the first request, then `cursor=<nextCursor>` for later pages; the response includes `total` and `nextCursor`.

## Changes

1. **Edge function — `supabase/functions/spokes-lookup/index.ts` (search action)**
   - Accept an optional `cursor` in the request body.
   - Return `nextCursor` and `total` from the 99spokes response alongside `items`.
   - When `cursor` is supplied, page the query that produced the current results (`usedQuery` from the previous response) instead of re-running the fallback chain — so "Show more" extends the list the user is actually looking at.
   - Pasted 99spokes links stay as they are: they already target one exact bike, so paging does not apply (`nextCursor: null`).
   - The 50-result cap per request stays; paging fetches 20 at a time, same as today's first page.

2. **Client library — `src/lib/spokes.ts`**
   - `searchSpokesDetailed(query, limit = 20, cursor?)` forwards the cursor and returns `nextCursor`, `total` and `usedQuery` in its result.

3. **Lookup screen — `src/components/management/SpokesLookup.tsx`**
   - Store `nextCursor` and `usedQuery` from each search.
   - A "Show more" button under the results list fetches the next page and appends it, skipping duplicates (results are already de-duplicated against the dealership's saved bikes by id; page results are also de-duplicated against the list already shown).
   - Button hides when there is no next page; shows a spinner while loading; a failed fetch shows the existing destructive toast and keeps the current list.
   - Starting a new search (Enter or Search button) resets paging to a fresh first page.

## Not changing

- Nothing about which bikes match, the relaxed-search fallback, saved-catalogue results, or the detail/spec loading.
- No database or migration changes.
