# Home page rebuild + page-by-page wireframe audit

Yes — the home page is still the old generic layout (badge, icon card grid, tick-list of benefits, blue-style CTA band). It only picked up the new colours and fonts. The wireframe asks for something quite different.

## What the wireframe wants on the home page

1. Headline "Run your bike business like a trading desk." with a short line under it and two buttons (Get started, See it work).
2. A large product screenshot of the bikes table directly under the headline — the app itself is the image.
3. A strip of three figures: stock at cost, average margin, days to sold (demo numbers, counting up once when scrolled into view).
4. The pipeline shown as a row of stage flaps (Intake → Cleaning → Inspection → Repair → Listed → Sold), one flipping on a slow loop.
5. Three ruled rows beneath — Workshop, Selling, Money — each with a cropped screenshot instead of icon cards.
6. A "Works with what you already use" strip: Shopify, eBay, QuickBooks, InspectABike, Cycle Courier.
7. A pricing teaser, a final call-to-action band, then the footer.

## Audit of every page against the wireframes

Matches the wireframe now:
- Sign in / reset password, pricing, contact, invoices, quotes, bikes, bike record, logistics, parts, components, owners, reports, dashboard, intake, cleaning, inspection, submissions, repairs, social pages, 404.

Still off the wireframe:

| Page | Gap |
| --- | --- |
| Home | Old layout entirely (above) |
| Features | Icon/card grid; wireframe wants alternating ruled rows with screenshots |
| Blog index | Three-column cards; wireframe wants ruled rows (date · title · one-line standfirst) |
| Careers index | Cards; wireframe wants ruled role rows |
| Updates | Roadmap shown as cards; wireframe wants two ruled columns with Planned / In progress / Exploring flags |
| About | Belief cards; wireframe wants plain prose plus a ruled company facts block |
| Terms / Privacy / Cookies | No sticky in-page contents list; cookie page needs working preference controls |
| Jobs | Still a "coming soon" placeholder; wireframe wants real job rows with Start / Done |
| Staff activity | No page or link exists at all |
| Settings | Tabs run across the top; wireframe wants a vertical list down the left |
| Investor pages | Shown inside the full sidebar app frame; wireframe wants a slim read-only shell |

## Suggested order

1. Home page rebuild (the headline change is the most visible).
2. Features, Blog, Careers, Updates, About — the other marketing pages.
3. Legal pages: contents sidebar and working cookie controls.
4. Settings vertical tabs, investor slim shell.
5. Jobs page built out, staff activity page restored.

## Technical notes

- Screenshots for the home page and Features will be captured from the running app at 1280px and stored in `src/assets`, imported directly.
- Stat strip reuses `StatBlock`, the pipeline row reuses `StageFlap` (its flip animation already exists), logo strip reuses `IntegrationTile` styling.
- Marketing rows and ruled indexes reuse `Panel` / `QueueRow` from `src/components/velo/PageShell.tsx`; no new design tokens needed.
- Staff activity needs its page and route rebuilt (merging fulfilment events, inspections, repair decisions and assignments) — it is not currently in the codebase.
- Jobs currently renders `PlaceholderPage`; building it out means reading the existing jobs data model first.
