# Restrict Inbox and Website settings tabs to super admins

## What changes

In Settings, the **Inbox** tab (enquiries + job applications) and **Website** tab (blog posts + job openings) become visible to the super user (info@velodealer.com) only. Regular admins keep: User Management, System, Integrations, Listing Formats, Storage Bays, Security.

## Why

Support enquiries and job applications contain personal data for VDMS Ltd, and the blog/careers editors publish to the shared velodealer.com website — these belong to the platform owner, not each dealer's admin.

## Technical details

- `src/pages/SettingsPage.tsx` only:
  - Wrap the `inbox` and `website` TabsTrigger in `{isSuperAdmin && ...}` (same pattern as the existing `super` tab).
  - Wrap their TabsContent blocks the same way.
  - Adjust the tab grid column count: super admin keeps 9 columns; non-super-admin admins drop from 8 to 6.
- No database or permission changes — the underlying tables already enforce access; this is purely which tabs render.
- Default tab stays `users`, so no one lands on a hidden tab; a direct `?tab=inbox` link simply shows an empty tab list selection for non-super-admins (acceptable), or we can fall back to `users` — will add a small guard so non-super-admins are redirected to the Users tab if the URL requests a hidden tab.
