# Public EULA and Privacy Policy pages

Intuit requires two publicly reachable URLs (no sign-in) before a QuickBooks app can be published: an end-user licence agreement and a privacy policy. VeloDealer currently has neither, and every route except the landing/auth pages is behind the auth guard.

## What gets built

- `/terms` — End-User Licence Agreement page, publicly accessible.
- `/privacy` — Privacy Policy page, publicly accessible.
- Both rendered outside the auth guard and outside the app sidebar layout, so a logged-out Intuit reviewer sees the full text.
- Simple branded document layout: heading, last-updated date, numbered sections, back-to-home link, reusing existing design tokens.
- Footer links to both pages so they are discoverable and crawlable.
- Per-page title and meta description for SEO/social.

## Content

Standard SaaS wording tailored to VeloDealer (bicycle dealer management), covering:

EULA: licence grant and restrictions, accounts and acceptable use, customer data ownership, third-party services (QuickBooks Online, Cycle Courier Co, Supabase), availability, liability limits, termination, governing law (England and Wales), contact.

Privacy policy: what is collected (account details, bike/customer/invoice records, usage logs), why, legal basis, third-party processors including Intuit QuickBooks and what is shared with them, retention, UK GDPR rights, cookies/local storage for the session, security, contact.

Both pages carry a short note that the text is a template and should be reviewed by the business before final publication, and placeholders for company name, registered address, and contact email.

## Technical detail

- New `src/pages/TermsPage.tsx` and `src/pages/PrivacyPage.tsx`, plus a small shared `LegalPage` wrapper for the document shell.
- Two routes in `src/App.tsx` registered like `/auth` — plain elements, no `guarded(...)`, no `Layout`.
- Links added in `src/components/Footer.tsx`.

## Follow-up for you

Once published, paste `https://<your-domain>/terms` and `https://<your-domain>/privacy` into the Intuit form. The app must be published (not just previewed) for those URLs to resolve for Intuit.
