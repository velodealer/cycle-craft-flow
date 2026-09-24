# Fix: Asif Hussain's investor page shows nothing

## What I checked
- Asif's account is set up correctly: he's an investor at Broximo Prestige Steeds, his email is confirmed, and he last signed in today.
- The Basso Astra Shimano 105 Di2 (BPS-BAS-0360) is linked to him, at a 50% share, status Ready.
- The access rules allow him to see that bike, its jobs and its parts, and the dealership is active.

So the data is right. His screenshot shows the page stuck loading ("…" in every box, empty "Your bikes"). The page is failing to load, not missing the bike.

## Likely cause (not confirmed yet)
The investor page only starts loading once his profile has loaded. If the profile load fails, or any step throws an error, the page never stops loading and shows no error message.

## Steps
1. **Reproduce as Asif:** open the investor page signed in as his account (this needs your approval) and record what fails: the profile load, the bikes list, or the costs.
2. **Fix the cause I find:** for example, the profile never loading for investors, or a failing query.
3. **Never spin forever:** always stop the loading state. If something fails, show a clear message with a Retry button. If his profile is missing, say so instead of showing "…".
4. **Check the result:** reload as Asif and confirm the Basso Astra shows with its costs and his 50% share.

## Technical details
- `src/pages/investor/InvestorDashboardPage.tsx`: the effect returns early when `profile?.user_id` is empty, so `loading` stays true; there's no try/finally and query errors are ignored. Add error state, try/finally, and handle a missing profile.
- `src/hooks/useAuth.tsx`: expose a `profileLoading`/profile error state so guards and pages can tell "loading" apart from "failed".
- Check `InvestorBikePage.tsx` for the same pattern.
- No database changes expected.
