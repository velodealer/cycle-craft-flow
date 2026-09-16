# Branded password reset + restricted email settings

Two changes: password reset emails come from VeloDealer through Resend, and the sender/link fields in the email settings are visible only to you.

## 1. Password reset through Resend

Today "Forgot password" uses the built-in Supabase email, which is unbranded and outside your control.

New flow:

1. On the sign-in screen, "Forgot password" calls a new backend function with the email address.
2. The function creates a secure, single-use reset link for that account and sends it with the same VeloDealer email styling used for the other notifications, from your Resend sender address.
3. The person clicks the link, lands on the existing Reset password page, sets a new password, and signs in.

Safety details:
- The response is always "If that address has an account, a reset link is on its way" — it never reveals whether an email is registered.
- The link is valid once and expires; unknown addresses are silently ignored (no email sent).
- Password reset emails always send, regardless of the notification toggles — only the master "Send emails" switch and the sender address apply.

## 2. Sender and link fields restricted

In Settings → Integrations → Email notifications:
- "From address" and "Link address used in emails" are hidden for everyone except a fixed super admin list (your address to start with).
- Everyone else who can reach Settings still sees the master switch, the three notification types and their recipients, and the test email button.
- The hidden values keep working from the saved settings; when they are hidden, saving leaves them untouched.

If you later want a proper super admin level (approving accounts, managing keys and webhooks), that is a separate, larger change.

## Technical notes

- New edge function `send-password-reset` (`verify_jwt = false`, added to `supabase/config.toml`): validates the email with Zod, uses the service-role client and `auth.admin.generateLink({ type: 'recovery', redirectTo: '<app>/reset-password' })`, renders a new `passwordResetEmail` template in `_shared/email-templates.ts`, and sends it via a new `sendDirect` path in `_shared/email.ts` (explicit recipient, bypasses `resolveRecipients` and the per-kind toggle, honours `enabled`, `from_address` and `app_url`). Returns `{ ok: true }` for every valid-format address.
- `src/pages/Auth.tsx`: replace `supabase.auth.resetPasswordForEmail` with `supabase.functions.invoke('send-password-reset', { body: { email } })`; same toast copy.
- Confirm `src/pages/ResetPassword.tsx` handles the recovery session the generated link creates (hash tokens and/or `code`); adjust if it only handles one form.
- `src/lib/superAdmin.ts`: `SUPER_ADMIN_EMAILS` constant plus `isSuperAdmin(email)`.
- `src/components/settings/EmailNotifications.tsx`: wrap the two inputs in `isSuperAdmin(profile?.email)` from `useAuth`; unchanged values are still submitted from state so saving does not wipe them.
- Deploy `send-password-reset`. No schema changes.
