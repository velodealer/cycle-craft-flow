# Fix: investor page shows "not signed in" instead of the sign-in screen

## What's actually happening
Asif has never requested a password reset, and his account last signed in successfully today at 15:24. So his password isn't the problem. The message means that browser tab had no active sign-in when it opened velodealer.com/investor. The investments page doesn't send signed-out visitors to the sign-in screen — it just shows the empty page with "You are not signed in". First step: confirm with a test that a fresh sign-in as an investor lands on the page with bikes showing (to rule out a sign-in timing problem on that page).

## Changes
1. Investments page and single-bike investor page: if nobody is signed in, go straight to the sign-in screen instead of showing an empty page.
2. After signing in, investors land back on their investments page (already the case — will confirm).
3. After a password reset, show "Password updated — please sign in" on the sign-in screen so it's clear the next step is to sign in.
4. "Retry" on the error banner becomes "Sign in" when the problem is being signed out.

## What Asif should do now
Go to velodealer.com/auth, sign in with the new password, and he'll be taken to his investments with the Basso Astra.

## Technical notes
- `InvestorDashboardPage.tsx` / `InvestorBikePage.tsx`: when `!authLoading && !user`, `<Navigate to="/auth" replace />`.
- `ResetPassword.tsx`: navigate to `/auth?reset=1`; `Auth.tsx` shows a notice when `reset=1`.
- Verify with Playwright: signed-out visit to `/investor` redirects to `/auth`.
