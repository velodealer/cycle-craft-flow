## Fix: "new row violates row-level security policy for table bikes" when creating an investor bike

### Root cause
`AddInvestorDialog` creates the new investor with `supabase.auth.signUp`. `signUp` replaces the current session — the logged-in admin is silently swapped for the brand-new investor account. When the admin then clicks **Create Bike**, the insert runs as the investor, who is not covered by any insert/manage policy on `bikes`, so Postgres rejects it with the RLS error.

The user-management `AddUserDialog` has the same flaw, but it isn't hit in normal flow because nobody immediately performs an admin-only write right after.

### Fix
Create the investor via a Supabase Edge Function that uses the service-role key, so the admin's session is never disturbed.

**1. New edge function `supabase/functions/create-investor/index.ts`**
- `verify_jwt = true` (default) — only signed-in users can call it.
- Verify the caller is an admin: read the JWT, look up their profile role, reject if not `admin`.
- Use the service-role client to:
  - `auth.admin.createUser({ email, password, email_confirm: true, user_data: { name } })`
  - `profiles.update({ role: 'investor', name }).eq('user_id', newUser.id)` (the `handle_new_user` trigger already inserts the profile row).
- Return `{ user_id, name, email }`.

**2. Edit `src/components/management/AddInvestorDialog.tsx`**
- Replace the `supabase.auth.signUp` + profile-update block with `supabase.functions.invoke('create-investor', { body: { name, email, password } })`.
- Keep the same `onCreated({ user_id, name, email })` contract so `BikeForm` auto-select keeps working.
- Update the success toast (email is auto-confirmed; no verification step needed).

No DB migration is required (the `investor` role already exists; RLS on `bikes` is correct — the admin was simply no longer the caller).

### Files
- **New:** `supabase/functions/create-investor/index.ts`
- **Edit:** `src/components/management/AddInvestorDialog.tsx`
