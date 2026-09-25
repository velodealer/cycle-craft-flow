# Project architecture rules

- Keep eBay notification public-key normalization and raw-body signature verification in the shared notification helper so endpoint behavior and regression tests use the same cryptographic path.
- Browsers never read provider credentials: `integrations` exposes only non-secret columns to signed-in users, settings come through `get_integration_settings` (secrets stripped), and token-bearing connection tables are service-role only — so one dealership can never see another's sign-ins.
