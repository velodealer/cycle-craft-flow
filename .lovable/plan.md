# Implement the VeloDealer brand handbook and logo suite

Apply the supplied brand book across the public website, signed-in product, authentication, investor view, emails, browser icons and social presentation. Keep the existing trade-desk layouts and product behaviour; this is a focused brand-compliance pass.

## Brand assets

- Add the official flap symbol and dark/light horizontal lockups from the supplied package through the project asset system.
- Install the supplied favicon set, Apple touch icon, web-app icons and manifest files in the browser-required locations.
- Keep the supplied Shopify App Store artwork available as the canonical listing asset without displaying it inside the product.
- Create one small reusable VeloDealer brand component that chooses the correct official symbol or lockup by context and enforces the handbook minimum sizes and clear space.

## In-product branding

- Replace bicycle placeholder icons and hand-set “VeloDealer” wordmarks in the signed-in top bar, sidebar treatment, sign-in, sign-up, password reset and investor header.
- Follow the handbook’s in-product rule: 28px symbol in the sidebar, wordmark only when there is room, and no descriptor inside the working product.
- Keep the logo static; only workflow stage flaps retain their existing movement.
- Preserve all role-aware navigation and product behaviour.

## Public website branding

- Replace the public header and footer bicycle icons/text lockups with the official horizontal dark lockup at compliant sizes, falling back to the symbol on narrow screens.
- Apply the same mark consistently across every public page through the shared header and footer.
- Keep integrations visually neutral and equally weighted; no dealer, courier or inspection partner receives special prominence.

## Handbook alignment

- Set the global tokens to the handbook’s exact Board, Panel, Chalk, Amber, Chalk Dim, Line, Gain and Loss colours while retaining semantic theme classes.
- Keep Bricolage Grotesque for titles and major figures and IBM Plex Sans for interface text, tables and references; retain tabular numerals and remove any remaining brand-area letter-spacing that conflicts with the supplied lockups.
- Audit visible product and marketing wording for the fixed vocabulary: use “stock”, “bike”, “fault”, “job”, “order” and “margin”; do not use “inventory” or “item” where they refer to dealer stock or bikes.
- Keep gain/loss colours restricted to financial figures and amber reserved for action, attention and state changes.

## Email and metadata

- Update transactional email presentation to a white letterhead using the official light-background lockup, handbook colours and restrained typography while preserving all existing message content and actions.
- Replace the old favicon and social artwork references with the supplied brand assets and update browser theme colour to the exact Board value.
- Keep legal entity references as “Vdms Ltd” and the public product name as “VeloDealer”; use “velo dealer management system” only as the category descriptor where appropriate.

## Verification

- Check the public home page, signed-in shell, sign-in/reset screens and investor view at desktop and phone widths.
- Confirm logo sizing, clear space, contrast, no clipping, and no placeholder bicycle marks remain in brand positions.
- Verify favicon/manifest metadata, transactional email HTML, and a clean project build.

## Technical notes

- Extract only the required supplied assets; do not copy archive metadata or unrelated files into the project.
- App-served logo artwork will use CDN asset pointers; favicon/PWA files remain real public files because browsers require direct URLs.
- No database, permissions, workflow, integration or reporting logic changes.
