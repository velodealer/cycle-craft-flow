# Public website build-out

Add the missing public pages, tidy the site navigation, and give the super admin an inbox for contact tickets and job applications.

## Shared header and footer

- One header and one footer used by every public page (home, features, pricing, about, blog, careers, contact, terms, privacy, cookies).
- Header: VeloDealer logo, links to Features, Pricing, Blog, About, Careers, Contact, plus Sign in / Get started (or Dashboard when signed in).
- Footer columns:
  - Product: Features, Pricing, Updates & Roadmap
  - Company: About, Blog, Careers, Contact
  - Support: API Documentation (marked "Coming soon", not clickable), Privacy Policy, Terms of Service, Cookie Policy
- Remove the "Demo"/"Watch Demo" link and the "Help Center" link from the home page and footer.

## New pages

**Features** (`/features`) — every capability grouped into sections: bike intake and photos, workshop and repairs, inspections (InspectABike), parts and components library, bike builder quotes, sales, invoicing and VAT margin, QuickBooks accounting, logistics and courier bookings, Shopify and eBay listings, Typeform bike submissions, storage bays and printed labels, investor bikes and profit share, reports and staff activity, social media planner, email notifications, roles and permissions.

**Updates & Roadmap** (`/updates`) — timeline of what has shipped (drafted from the work done, grouped by theme/date) plus a roadmap of planned items marked Planned / In progress / Exploring.

**About** (`/about`) — the story, what the product is for, company details (VDMS Ltd, 30 Wake Green Road, Birmingham, B13 9PB, info@velodealer.com).

**Blog** (`/blog`, `/blog/:slug`) — posts stored in the database and written inside the app. Ships with a starter set of posts, one per major capability, each explaining how it changes a shop's day-to-day process (intake, inspections, repair approvals, costing and margin, listing to Shopify/eBay, accounting, logistics, reporting).

**Careers** (`/careers`, `/careers/:slug`) — two openings: Customer Success Manager and Software Developer, each with a description and an application form (name, email, phone, links, cover note, CV upload). Applications are saved and the super admin gets an email alert.

**Contact** (`/contact`) — form creating a support ticket; super admin gets an email alert.

**API Documentation** — no page; footer entry labelled "API Documentation — coming soon".

## Admin inbox

New Settings-area page (super admin / admin only) with two tabs:
- **Tickets** — contact submissions with status (new, open, closed); open one, type a reply, it is emailed to the sender via Resend and kept in the thread.
- **Applications** — job applications with CV download and status (new, reviewing, rejected, hired).

## Technical notes

- Routes added in `src/App.tsx`; new `PublicLayout` component (header + footer) replacing the ad-hoc header in `PricingPage.tsx` and `LegalPage.tsx` so all public pages match.
- Database (new tables, RLS + grants):
  - `blog_posts` — slug, title, excerpt, body (markdown), cover image, tags, status (draft/published), published_at, author. Public read of published posts only; admins manage.
  - `job_openings` — slug, title, location, type, summary, description, is_open. Public read of open roles; admins manage.
  - `job_applications` — opening, name, email, phone, links, cover note, cv_path, status. Anonymous insert allowed; admin read/update only.
  - `support_tickets` — name, email, subject, message, status, source. Anonymous insert; admin read/update.
  - `support_ticket_replies` — ticket, body, sent_by, sent_at. Admin only.
  - Storage bucket `job-applications` (private) for CVs, with an upload policy for anonymous applicants and admin-only read.
- Edge functions (Resend, direct API as before):
  - `submit-contact` — validates and inserts the ticket, emails the super admin.
  - `submit-application` — validates and inserts the application, emails the super admin.
  - `reply-support-ticket` — admin-only, sends the reply to the customer and records it.
- Blog editor and job-opening editor live in the existing Settings area, reusing current form patterns.
- Meta title/description per page for search, single H1, semantic sections.
