# Manage the VeloDealer Shopify app from here with Shopify CLI

Yes, this can be done. The Shopify CLI can't use a normal browser sign-in from here. It can sign in with a Partner "CLI token" instead, which is the method Shopify provides for automated setups.

## What you'll do (one time)
1. In the Shopify Partner Dashboard, go to Settings > CLI token and create a token.
2. Paste it into the secure form I'll open. It gets saved as a secret and never goes into the code.
3. Confirm the app's Client ID. I'll use the one already saved for the Shopify connection.

## What I'll then set up
- A Shopify app settings file (`shopify.app.toml`) in the project that holds the app's settings in one place:
  - App URL: `https://api.velodealer.com/functions/v1/shopify-install`
  - Redirect URL: the existing `shopify-oauth` callback
  - Permissions: products, inventory, orders, locations (same as today)
  - Compliance webhooks: all three pointing at `shopify-compliance`. This fills in the fields you've been pasting by hand.
  - Order webhooks (`orders/paid`, `orders/cancelled`, `refunds/create`) pointing at `shopify-webhook`
  - Embedded app: off
- I run `shopify app deploy` from here to push those settings to your app. Later changes work the same way: I edit the file and deploy again.

## Limits
- App Store listing text, screenshots, pricing and submitting for review still have to be done in the Partner Dashboard. The CLI can't change them.
- Deploying replaces the app's current configuration. Anything set in the dashboard that isn't in the file gets overwritten, so I'll pull the current config first (`shopify app config link`) and merge it.

## Technical notes
- Run the CLI with `npx @shopify/cli@latest` and `SHOPIFY_CLI_PARTNERS_TOKEN` taken from the secret, plus `--client-id` and `--force` so no prompts appear.
- The CLI runs only in the sandbox. Nothing is added to the live website.
