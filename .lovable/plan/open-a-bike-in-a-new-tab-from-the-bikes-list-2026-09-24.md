# Open a bike in a new tab from the Bikes list

## What changes

- In the Bikes list (`src/components/management/BikeList.tsx`), the bike name becomes a real link so a browser "open in new tab" gesture works:
  - **Right-click → Open link in new tab**, **middle-click**, and **Cmd/Ctrl+click** all open the bike record in a new tab.
  - A normal click behaves exactly as today — it opens the bike in the same view.
- Add a small **open-in-new-tab icon button** next to the bike name (desktop table row and mobile/tablet card) for an explicit one-tap way to open a bike in a new tab.

Applies to all three bike list layouts: desktop table, tablet cards, and mobile cards. The photo, checkboxes, location picker and prices are unchanged.

## Technical details

- One file changed: `src/components/management/BikeList.tsx`.
- Replace the title `<button>` with an `<a href={"/bikes/" + bike.id}>`; keep the in-app navigation on plain click via the existing `onEdit` handler (preventDefault + navigate) so nothing reloads, while native browser gestures work on the anchor.
- The explicit icon button (lucide `ExternalLink`) uses `window.open("/bikes/" + bike.id, "_blank", "noopener")`.
- No data, routing, or backend changes — `/bikes/:id` already exists.
