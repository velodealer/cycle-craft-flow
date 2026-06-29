## Add Investor (similar to Add Consigneer)

When the bike source is set to "Investor bike" in the Bike form, the investor dropdown will gain an "Add new investor" action — mirroring how owners/consigneers are added inline.

### Flow
1. In `BikeForm.tsx`, when `source = 'investor'`, the investor selector shows existing investors (profiles with `role = 'investor'`) plus an "+ Add new investor" item at the bottom.
2. Clicking it opens an `AddInvestorDialog` modal (new component, modeled on `AddUserDialog`).
3. The dialog collects: Name, Email, Temporary Password (with Generate button) — role is locked to `investor`.
4. On submit it creates the auth user via `supabase.auth.signUp`, then updates the new profile's `role` to `'investor'`.
5. On success, the dialog closes, the investor list refetches, and the newly created investor is auto-selected in the BikeForm.

### Files
- **New:** `src/components/management/AddInvestorDialog.tsx` — focused dialog (no role picker; investor only).
- **Edit:** `src/components/management/BikeForm.tsx` — fetch investors from `profiles` where `role = 'investor'`, render the dropdown with the "+ Add new investor" trigger, wire dialog + auto-select.

### Notes
- Reuses the existing signup pattern from `AddUserDialog` (no service-role required client-side).
- No DB migration needed — `investor` role already exists in the `user_role` enum.
- The new investor will need to confirm their email before they can sign in to the investor portal (same as other user types created this way).
