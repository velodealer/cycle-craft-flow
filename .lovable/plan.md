# VeloDealer — "The trade desk" retheme (pass one)

Apply the uploaded design system across the whole product and the public website: dark board, chalk text, one amber signal, two new typefaces, and the signature stage flap. Every page changes appearance immediately. Three screens — Dashboard, Bikes list, Bike record — are also rebuilt to their wireframe layouts. The remaining pages keep their current layout for now and get their wireframe layouts in a follow-up pass.

## What changes

**Everywhere**
- Dark surfaces throughout: deep blue-charcoal background, raised panels for tables, cards and dialogs, amber for the single primary action, links, focus and "needs you" states.
- Green and red appear only next to figures (margin, profit, loss), always with a sign or arrow.
- New type: Bricolage Grotesque for page titles and big figures, IBM Plex Sans for everything else, with numbers that line up in columns.
- Tighter corners (4px), no shadows — depth comes from lighter panels.
- Buttons, badges and inputs restyled once, so all 35+ pages inherit the change.

**Signature pieces (used across many screens)**
- Stage flap: the chunky INTAKE / CLEANING / REPAIR / LISTED / SOLD block that flips once when a bike moves stage.
- Stage progress bar restyled: done stages dim, current stage amber, upcoming faint.
- Margin triple: cost → asking → margin as one unit, hidden entirely for mechanics.
- Integration tile: one shared unit for QuickBooks, Shopify, eBay, Typeform, InspectABike, Cycle Courier and email — used on Settings and the dashboard's system health row.
- Stat block: label above, big figure below, change beside it; counts up once on load.

**Rebuilt to wireframe in this pass**
- Dashboard: stage cards with "entered today" badges, owner-approval card flagged amber when non-zero, 30-day pipeline bars, revenue stat blocks, system-health tiles in a row.
- Bikes list: search, four filters, dense 44px rows with thumb, reference, flap, bay and margin triple; expand opens a quick-look drawer with "Open full record"; one card per bike on mobile.
- Bike record: stage bar across the top, two-thirds main column (details, spec with the 99Spokes lookup, photos, descriptions, listing cards, faults) and a one-third rail (stage history, pricing and cost breakdown, investor panel, collection/delivery).

**Public website** goes dark at the same time: header, footer, landing, features, pricing, updates, about, blog, careers, contact and the three legal pages, with long-form text at a comfortable reading width.

## Kept as-is (layout only) this pass
Submissions, Intake, Cleaning, Inspection, Repairs, Logistics, Parts, Components, Jobs, Quotes, Invoices, Owners, Reports, Settings, Social, Investor, Staff activity — they pick up the new colours, type and components automatically, but their section arrangement stays until the follow-up pass.

## Technical notes

- `src/index.css`: board values replace `:root`; the `.dark` block mirrors them exactly so a stray class toggle is a no-op; the old light palette is deleted. New variables `--panel-high`, `--amber-tint`, `--gain`, `--loss`; `--radius: 0.25rem`; sidebar tokens remapped (board background, panel-high active, amber primary).
- shadcn mapping exactly per design §12 (background/foreground/card/primary/secondary/muted/accent/destructive/success/warning/info/border/input/ring).
- `tailwind.config.ts`: `font-display` (Bricolage Grotesque 700/800) and `font-sans` (IBM Plex Sans 400/500/600) loaded via Google Fonts in `index.html`; new `flap-flip` and `stat-tick` keyframes replacing the animate zoo; `tabular-nums` applied app-wide to tables and stats.
- `badge.tsx`: add `success` / `warning` / `info` cva variants and retire className overrides at their call sites. `button.tsx`: amber default, plus a `bench` size (h-12) for workshop screens.
- New components under `src/components/ui-velo/`: `StageFlap`, `MarginTriple`, `StatBlock`, `IntegrationTile`; `StatusProgressBar.tsx` restyled to the three states (it holds the only remaining hardcoded colours, along with 11 other files that get cleaned up).
- Flap colour drives off a `data-stage` attribute, not per-stage classes; `prefers-reduced-motion` swaps instantly.
- Files rebuilt: `BPSDashboard.tsx`, `management/BikeList.tsx`, `bike/BikeDetailView.tsx`, plus `public/PublicLayout.tsx` and the marketing pages for the dark treatment.
- No data, role, permission or integration logic changes — presentation only.

## Verification
Screenshot the dashboard, bikes list, bike record, a bench screen and the landing page at desktop and phone widths, and confirm the build is clean.
