# Bigger logo on the public site header

## Problem
The VeloDealer logo in the public header (home page and all public pages) renders at 36px tall on desktop (32px symbol on mobile), which looks undersized against the 64px-tall header bar.

## Fix (one file: `src/components/public/PublicLayout.tsx`)
- Desktop header lockup: `h-9` → `h-11` (44px tall)
- Mobile header symbol: `size-8` → `size-10`
- Leave the footer logo (`h-10`) unchanged — it's already proportionate and the user only flagged the home-page header.

The logo asset is a 1120×256 PNG, so the larger sizes stay sharp. No other pages or components are touched; the same header is shared by every public page, so the fix applies consistently.
