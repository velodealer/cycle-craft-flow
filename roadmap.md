# Roadmap — eBay Phases 2–7

## Workshop approval and jobs separation (2026-09-25)
- [x] Keep bikes on Repairs until every inspection repair has an approval decision
- [x] Move decided bikes with approved work into Jobs and keep declined repairs out
- [x] Share the bike-card structure across Repairs and Jobs
- [x] Align page access and dashboard repair counts

- [x] Migration (listing columns, ebay_orders, title_format)
- [x] Phase 2 smart titles
- [x] Phase 3 item specifics
- [x] Phase 4 category by type, 24 photos + gallery, Best Offer
- [x] Phase 5 order sync + despatch (runs every 5 min)
- [x] Phase 6 promoted listings
- [x] Phase 7 pre-publish checklist
- [x] Docs update
- [ ] Blocked on user: reconnect eBay (current sign-in has expired; also grants promotion permission)

## Checkpoint 2 additions (2026-09-24)
- [ ] {model} family de-dup ("Émonda Émonda SL 6 Pro Di2") + backfill; share de-dup rule with part parser ("Bontrager Bontrager")
- [ ] Report why {condition}, {condition_notes}, {description}, {sku} are empty (data vs mapping vs elsewhere)
- [ ] 2.6: clear bike_components.notes that merely duplicate components.description
- [ ] bikes.mpn from 99spokes model code
- [ ] Then: eBay Taxonomy getItemAspectsForCategory for Brand/MPN + full aspect set

## 99spokes result comparison (2026-09-25)
- [x] Keep distinct catalogue records and show their differing brakes, cassette and colour availability
- [x] Remove repeated family names from search-result headings
