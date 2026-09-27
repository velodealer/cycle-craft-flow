# Roadmap — eBay Phases 2–7

## Dedicated listing images (2026-09-26)
- [x] Add an ordered listing-image set to each bike
- [x] Add separate listing uploads with removal and ordering controls
- [x] Use listing images for eBay and Shopify with bike-photo fallback
- [x] Keep eBay preview/checks and Listings thumbnails aligned with the published set
- [ ] Blocked on external auth: verify upload, ordering and marketplace sync in a signed-in preview

## Workshop approval and jobs separation (2026-09-25)
- [x] Keep bikes on Repairs until every inspection repair has an approval decision
- [x] Move decided bikes with approved work into Jobs and keep declined repairs out
- [x] Share the bike-card structure across Repairs and Jobs
- [x] Align page access and dashboard repair counts
- [x] Make dashboard stage cards reconcile to active bikes and recover approved repairs with missing jobs

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

## eBay BrandMPN publish error (2026-09-28)
- [x] Keep Brand as the required item specific and remove product.brand plus every MPN field
- [x] Add and pass a regression test for the Inventory API product payload
- [x] Deploy the corrected eBay listing function
- [ ] Blocked on signed-in user: retry BPS-TRE-027T and confirm eBay publishes it
