# Fix the public site header on mobile and desktop

The top bar on the public pages currently wraps onto three stacked rows on a phone: logo, then Sign In / Get Started, then a side-scrolling row of page links that gets cut off mid-word. On desktop the same bar has mismatched sizing (oversized logo and buttons on the home page, smaller ones everywhere else) and the seven links crowd the buttons.

## What changes

Mobile (under the tablet width)
- One tidy row only: logo on the left, a "Get started" button and a menu button on the right.
- Tapping the menu button slides in a panel listing all seven pages (Features, Pricing, Updates, Blog, About, Careers, Contact) with Sign in / Get started at the bottom — or Dashboard and Sign out when already signed in.
- The panel closes when a link is tapped, and the page behind it can't scroll while it's open.
- No more sideways scrolling strip of links.

Desktop
- Single row: logo left, links centred, buttons right — comfortably spaced, no wrapping.
- Links get a subtle underline on the current page so people know where they are.
- The home page and every other public page use the exact same bar, at the same size.

## Technical notes

- Rewrite `PublicHeader` in `src/components/public/PublicLayout.tsx`: mobile row + shadcn `Sheet` menu (`hidden md:flex` for the desktop nav, `md:hidden` for the trigger), remove `flex-wrap` / `order-last` / `overflow-x-auto`, keep `PUBLIC_NAV` as the single link source and `NavLink` active styling.
- Move the signed-in avatar dropdown (Dashboard, Sign out) from `LandingPage.tsx` into `PublicHeader` so one component serves everything; delete the bespoke `<nav>` block in `src/pages/LandingPage.tsx` (lines 86-155) and render `<PublicHeader />` instead.
- Header height, icon size and button sizes standardised (`h-16` row, `h-6 w-6` logo icon, `size="sm"` buttons).
- Semantic tokens only; no new colours.
