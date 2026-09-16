# Pricing Page with TBC Placeholders

## Goal
Add a public `/pricing` page for VeloDealer subscription plans. All plan names, features and prices are shown as **TBC** placeholders — the content is final once you decide the tiers.

## What will be built

**New page: `src/pages/PricingPage.tsx`**
- Styled in the same visual language as the legal pages (shared header with the VeloDealer logo, "Back to home" link, contact footer).
- A short intro line explaining the Service is subscription-based and billed monthly or annually (matching the Terms).
- Three plan cards (Starter / Pro / Business — names are placeholders) in a responsive grid:
  - Price shown as **TBC** with "per month" underneath.
  - A feature list per card, each item shown as "TBC — feature" placeholders (e.g. number of users, integrations included, storage), so swapping in real values later is a find-and-replace away.
  - A "Choose plan" button on each card — it links to the sign-up page and does nothing paid; no payment integration is added.
- A short FAQ section below the cards: VAT excluded from prices (per the Terms), auto-renewal, how to cancel, 30-day fee-change notice — all taken from the Terms of Service so the two pages agree.
- Contact line: VDMS Ltd, 30 Wake Green Road, Birmingham, B13 9PB · info@velodealer.com.

**Wiring**
- Route `/pricing` added in `App.tsx` as a public page (no sign-in needed).
- "Pricing" link added to the site footer next to the Terms / Privacy / Cookie Policy links, and to the nav strip on the legal pages.
- Browser tab title and description set for the page ("Pricing | VeloDealer").

## Notes
- The Terms say fees are "displayed at velodealer.com" — this page becomes that place once the TBC values are replaced.
- No payment provider is connected; choosing a plan simply takes visitors to sign-up.

## Verification
- Build check, then load `/pricing` in the browser to confirm the layout renders on desktop and mobile widths and all links work.
