# Edit prices from the bike's Pricing & finance panel

Today the Pricing & finance panel on a bike page only shows the purchase, asking and sale figures — changing any of them means opening the full bike edit form. This adds quick editing right there.

## What changes

- An **Edit** button appears in the Pricing & finance panel header.
- Pressing it turns the three figures (Purchase, Asking, Sale) into number boxes, with **Save** and **Cancel** below them.
- Saving updates the bike straight away; the margin figures at the top of the panel and the cost breakdown refresh with the new numbers.
- Leaving a box empty clears that figure; negative numbers are rejected with a short message.
- A failed save keeps the boxes open and shows what went wrong, so nothing is lost.
- Only people who already see pricing can edit it — mechanics never see the panel, so nothing changes for them.

## Technical notes

- All work sits in `src/components/bike/BikeDetailView.tsx`, in the Pricing & finance card in the rail (currently lines ~484-522).
- Local state: `editingPrices`, plus a draft object for `purchase_price`, `asking_price`, `sale_price` seeded from `bike` when editing starts.
- Save: `supabase.from('bikes').update({...}).eq('id', bike.id)`, then `onUpdate()` and `refreshCosts()` so the margin triple and breakdown recompute. Values parsed with `parseFloat`; blank string becomes `null`.
- Toasts via the existing `toast` helper for success and failure.
- No schema, RLS or edge function changes — existing bike update permissions apply.
