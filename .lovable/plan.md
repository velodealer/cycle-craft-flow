# Subprocessors list + Cookie Policy page

## 1. Subprocessor list (added to the Terms page)

A new "Subprocessors" section in the Terms page (and a matching mention in Privacy), listing every outside service the app actually uses:

| Provider | Purpose | Data involved |
| --- | --- | --- |
| Supabase | Hosting of database, file storage, authentication and server functions | All app data: bikes, customers, invoices, staff accounts, uploaded photos |
| Lovable | App hosting and delivery of the website | Technical connection data |
| Resend | Sending notification and password-reset emails | Recipient name and email address, message content |
| Intuit (QuickBooks Online) | Accounting: invoices, VAT and stock postings | Customer name, address, invoice and payment details |
| Cycle Courier Co | Booking bike collections and deliveries | Customer name, address, phone, bike details |
| InspectABike | Bike inspections and fault reports | Bike details, serial number, customer name |
| Typeform | Customer bike-submission forms | Whatever the customer enters, plus uploaded photos |
| Shopify | Listing bikes on a dealer's own store; order details back | Bike listing data, buyer contact from orders |
| eBay | Listing bikes on a dealer's own eBay account | Bike listing data |
| 99Spokes | Bike specification lookup | Make, model and year only (no personal data) |

Each row is shown with the provider's role and where it operates, plus a line saying customers are told before a new provider is added, and a contact address for objections.

If you use any provider I haven't seen in the app (for example an analytics or error-tracking tool added outside the app), tell me and I'll add it.

## 2. Cookie Policy page

New public page at `/cookies`, styled like the existing Terms and Privacy pages and linked from the same footer.

Content reflects what the app genuinely stores in the browser — it is a small, honest list:

- **Sign-in session** (stored in browser storage, not a cookie) — keeps you signed in; stays until you sign out.
- **Sidebar state cookie** (`sidebar:state`) — remembers whether the menu is open or collapsed; lasts 7 days.
- No advertising, tracking or analytics cookies are used.
- Note that eBay, Shopify, QuickBooks and Typeform set their own cookies on *their* sites when you sign in to connect them, with links to their policies.
- How to clear or block cookies in your browser, and that blocking the sign-in storage will stop you staying signed in.

Because there are no tracking cookies, no consent banner is needed — the page will say this explicitly.

## Technical notes

- New `src/pages/CookiePolicyPage.tsx` using the shared `LegalPage` wrapper; route `/cookies` added in `src/App.tsx` alongside `/terms` and `/privacy`.
- Footer links updated wherever Terms/Privacy already appear (landing page footer).
- Subprocessor section appended to `src/pages/TermsPage.tsx` before the Contact section, with a cross-reference from `PrivacyPage.tsx`.
- The existing `[Company Name]`, `[Registered Address]`, `[Contact Email]` placeholders remain until you give me the real details — the new pages will use the same placeholders for consistency.
