# Shopify App Store review — re-check

Shopify's AI Toolkit command only runs on your own computer, so I ran the same checks here against the live app.

## What passes now

- Install always starts on Shopify: the app address redirects into the install flow (checked, returns a redirect).
- Privacy (compliance) address refuses unsigned requests (checked, 401).
- Sign-in return address refuses unsigned requests (checked, 401).
- Uninstall notice is registered in the app settings and points at VeloDealer, which switches that store's connection off.
- Permissions asked for are only products, inventory, orders and locations.
- Released config is version vdms-6.

## Still to do (only you can do these)

1. In the Partner Dashboard: listing text, screenshots, app icon, support email, privacy policy link.
2. Give the reviewers a test store login plus short step-by-step notes.
3. Run a real install and uninstall once on your test store.
4. Re-run Shopify's automated checks, then submit.

## What I would do next if you approve

- Walk the install and uninstall once from here against the test store and report exactly what a merchant sees.
- Fix anything that check turns up (for example wording on the install page or a missing redirect back to the store admin).

No code changes are proposed until that run shows a problem.
