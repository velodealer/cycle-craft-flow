# Roadmap — production readiness

## Phase 1
- [ ] Enable leaked-password protection (user must toggle in Supabase dashboard)
- [x] Signed-out access removed from all tables except blog posts and job roles
- [ ] Review the remaining warnings: 14 admin database functions signed-in users can run, 5 tables with no access rules
- [x] Dealer-separation test run (0 foreign rows across 39 tables); make it a repeatable automated check
- [x] Failed accounting syncs card with Retry / Retry all on dashboard
- [x] Owner email alert for failed syncs
- [ ] Live-test a brand-new dealership connecting each service (Broximo done)
- [x] Typeform 15-minute backup fetch
- [x] Mobile pass on main pages (code pass; signed-in phone check still needed)

## Phase 2
- [ ] Money-rule tests (VAT, profit, numbering, mark-ups, handover block)
- [ ] Error tracking log for super admin
- [ ] Backup check + practice restore
- [ ] Remove Sept 2026 backup tables
- [ ] Paging + indexes

## Phase 3
- [ ] Card subscription payments
- [ ] GDPR export/delete
- [ ] Status page, Help section
