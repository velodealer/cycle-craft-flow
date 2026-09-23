# VeloDealer → eBay listing process

How a bike goes from VeloDealer to a live eBay listing, and every field we send.
Source: `supabase/functions/_shared/ebay-listing.ts`, `_shared/ebay.ts`, `_shared/listing-template.ts`, `ebay-oauth/`, `ebay-sync-bike/`, `src/lib/listingTemplate.ts`.

## 1. Overview

```text
Connect eBay (per dealership)
  -> choose policies + despatch location (Settings -> Integrations)
  -> bike has price, type, photos, spec
  -> PUT inventory_item/{sku}          (product data, aspects, condition)
  -> POST/PUT offer                    (price, category, policies, HTML description)
  -> POST offer/{id}/publish           (goes live, returns listingId)
  -> ebay_listings row saved + activity entry
```

## 2. Connecting

- OAuth is **per dealership**. The state is stored in `ebay_oauth_states` (state, business_id, user_id, environment). The callback works out the business from that row.
- `prompt=login` makes eBay always show its sign-in page.
- The connection is stored in `integrations` (name `ebay`, business_id). There is a unique index on `(name, business_id)`.
- Environment is `sandbox` or `production`. Sandbox items link to `https://www.sandbox.ebay.co.uk/itm/`, live items to `https://www.ebay.co.uk/itm/`.
- **Disconnect** only removes the tokens from VeloDealer. eBay remembers the approval. To revoke it fully, go to https://accounts.ebay.co.uk/acctsec/security-center/third-party-app-access

## 3. Settings and defaults (per connection)

| Setting | Used for | Default |
|---|---|---|
| `marketplace_id` | Offer marketplace, language headers | `EBAY_GB` |
| `currency` | Offer price currency | `GBP` |
| `category_id` | eBay category | `177831` (Sporting Goods > Cycling > Bikes) |
| `condition` | Wanted condition | `USED_EXCELLENT` |
| `fulfillment_policy_id` | Postage policy | required |
| `payment_policy_id` | Payment policy | required |
| `return_policy_id` | Returns policy | required |
| `merchant_location_key` | Despatch location | `velodealer-main` |
| `postcode` | Used when the location is created automatically | `BN1 1AA` |

Each bike can override `category_id` and `condition` through its `ebay_listings` row.

**Policies** can be created, edited and deleted inside VeloDealer (EbayPolicyDialog, using the Account API `fulfillment_policy` / `payment_policy` / `return_policy`):
- Postage: name, description, handling days (0/1/2/3/5), UK service code, free postage, cost, local pickup.
- Payment: name, description, immediate pay.
- Returns: name, description, returns accepted, window (14/30/60 days), who pays for returns (BUYER/SELLER), refund type (MONEY_BACK / MONEY_BACK_OR_REPLACEMENT).
- Error **20403** "Seller is not opted in to business policies": the seller must opt in at https://www.ebay.co.uk/bp/manage (sandbox: https://www.sandbox.ebay.co.uk/bp/manage). The card shows an alert when this happens.

**Despatch location**: `ensureLocation()` looks up the key. If it isn't found, it creates a location: country GB, the postcode, name "VeloDealer", type WAREHOUSE, status ENABLED.

## 4. Checks before listing

The listing is blocked, with a plain message, when:
- the policies aren't chosen,
- the asking price is missing or 0 or less,
- there is no bike type,
- any aspect the category requires is missing (see section 6).

## 5. Inventory item — `PUT /sell/inventory/v1/inventory_item/{sku}`

| Field | Source |
|---|---|
| `sku` | `bike.reference` (or id). Characters other than `A-Z a-z 0-9 . _ -` become `-`. Maximum 50 characters. |
| `availability.shipToLocationAvailability.quantity` | `1` |
| `condition` | Resolved condition (section 7) |
| `product.title` | make + model + year + size, maximum 80 characters |
| `product.description` | `inventorySummary()`: plain text from listing_description or description. HTML and `&nbsp;` removed, spaces collapsed, cut at a sentence end within 3,900 characters, then `…` added. eBay's limit here is 4,000. |
| `product.imageUrls` | `bike.photos`, only http(s) links, first 12 |
| `product.aspects` | Section 6 |
| `product.brand` | `bike.make` |
| `product.mpn` | `bike.model` |

`conditionDescription` isn't sent at the moment.

## 6. Item specifics (aspects)

Each value is a single string, up to 60 characters. Empty values are left out.

| eBay aspect | VeloDealer source |
|---|---|
| Brand | make |
| Model | model |
| Bike Type | bike_type, mapped (see the table below) |
| Type | same as Bike Type |
| Frame Size | size |
| Colour / Color | colour |
| Frame Material | frame_material |
| Wheel Size | spec `wheel_size` |
| Number of Gears | spec `gears`, or else `speeds` |
| Brake Type | spec `brake_type` |
| Suspension Type | spec `suspension` |
| Gender | gender |
| Year | year |

Spec values are read from `spec_values`, either at the top level or inside any section.

**Bike Type mapping**

| VeloDealer | eBay |
|---|---|
| road | Road Bike |
| gravel | Gravel Bike |
| mtb_hardtail, mtb_full_sus | Mountain Bike |
| bmx | BMX |
| hybrid | Hybrid Bike |
| city | Comfort Bike |
| electric | Electric Bike |
| folding | Folding Bike |
| cargo | Cargo Bike |
| tt | Triathlon Bike |
| touring | Touring Bike |
| cyclocross | Cyclocross Bike |
| track | Track Bike |
| tandem | Tandem |
| recumbent | Recumbent Bike |
| kids | Kids Bike |
| anything else | tidied stored value (e.g. `fat_bike` becomes "Fat Bike") |

**Required aspects** come from the Taxonomy API: `GET /commerce/taxonomy/v1/category_tree/{treeId}/get_item_aspects_for_category?category_id=…`. Tree ids: GB 3, US 0, AU 15, IE 205, CA 2, DE 77, FR 71, IT 101, ES 186.

## 7. Condition

| Enum | eBay id |
|---|---|
| NEW | 1000 |
| LIKE_NEW | 2750 |
| NEW_OTHER | 1500 |
| NEW_WITH_DEFECTS | 1750 |
| USED_EXCELLENT | 3000 |
| USED_VERY_GOOD | 4000 |
| USED_GOOD | 5000 |
| USED_ACCEPTABLE | 6000 |
| FOR_PARTS_OR_NOT_WORKING | 7000 |

Wanted condition = the bike's listing override, else the setting, else `USED_EXCELLENT`.
The conditions a category accepts come from `GET /sell/metadata/v1/marketplace/{mp}/get_item_condition_policies?filter=categoryIds:{id}`.
`resolveCondition()` uses the wanted condition if it is allowed. If not, it tries that condition's fallback list, then any condition the category accepts. If eBay can't be asked, it sends the wanted value.

## 8. Offer — `POST /sell/inventory/v1/offer` (or `PUT offer/{offerId}`)

| Field | Value |
|---|---|
| `sku` | as above |
| `marketplaceId` | setting, default `EBAY_GB` |
| `format` | `FIXED_PRICE` |
| `availableQuantity` | `1` |
| `categoryId` | bike override, else setting, else `177831` |
| `listingDescription` | Rendered listing format HTML (section 9). eBay allows up to 500,000 characters. |
| `merchantLocationKey` | from `ensureLocation()` |
| `listingPolicies` | fulfillmentPolicyId, paymentPolicyId, returnPolicyId |
| `pricingSummary.price` | `{ value: asking_price, currency }` |

The offer id is taken from the `ebay_listings` row, or looked up with `GET offer?sku=`. An existing offer is updated. Otherwise a new one is created.
Then `POST offer/{id}/publish` runs. If eBay says "already published", that is treated as success.

## 9. Listing format (description template)

- `loadListingTemplate(platform='ebay')` uses the dealer's own format (their business_id) first, then a global one. If there is none, or the render fails, the built-in `bikeDescriptionHtml()` is used: paragraphs plus a spec list.
- `sanitiseForEbay` keeps `<style>` blocks and inline CSS. It removes scripts, outside stylesheets (e.g. Font Awesome, so icons won't show), forms and active content.
- eBay builds the mobile summary from the first ~800 characters. Put the key selling points first.

**Tokens** (single braces, e.g. `{make}`; empty values print nothing):

- Bike: `{title} {make} {model} {year} {colour} {size} {gender} {bike_type} {frame_material} {frame_number} {serial_number} {condition} {condition_notes} {description} {listing_description} {weight_kg} {is_electric} {has_suspension_fork} {has_rear_shock} {has_dropper} {accessories_included} {asking_price} {sale_price} {sku} {reference} {photos}`
- Blocks: `{components}` (bullet list), `{components_table}`, `{spec_list}`, `{spec_table}`
- Fitted parts: `{part_<slot>}` for brand and model, `{part_<slot>_detail}` for part number, weight, manufacturer details and notes. Slots: frame, headset, fork, rear_shock, wheelset, front_hub, rear_hub, spokes, front_tyre, rear_tyre, crank, cassette, chain, front_derailleur, rear_derailleur, shifters, bottom_bracket, power_meter, brakes, brake_levers, disc_rotors, handlebars, stem, grips, saddle, seatpost, pedals, ebike_system, ebike_battery, ebike_display, ebike_charger, mudguards, rack, lights, bell, kickstand, lock.
- Spec fields: `{spec_<section>_<field>}`, e.g. `{spec_frame_material}`, `{spec_fork_travel_mm}`, `{spec_drivetrain_groupset}`, `{spec_ebike_motor_brand}`, `{spec_used_mileage_km}`. The full list is searchable in Settings → Listing Formats.

## 10. Headers and language

`ebayFetch` sends `Accept-Language` and `Content-Language` for each marketplace:
EBAY_GB en-GB, EBAY_US en-US, EBAY_AU en-AU, EBAY_IE en-IE, EBAY_CA en-CA, EBAY_DE de-DE, EBAY_FR fr-FR, EBAY_IT it-IT, EBAY_ES es-ES (default en-GB). A wildcard value causes a 400 error.

## 11. After listing

`ebay_listings` (one row per bike, upsert on bike_id) stores business_id, environment, sku, offer_id, listing_id, listing_url (with www), status, quantity, last_synced_at, last_error, and optional category_id and condition overrides.

- **Update**: running the listing again updates the inventory item and offer, then publishes.
- **End** (sold elsewhere or pulled): `POST offer/{id}/withdraw`, then status `ended`, quantity 0, listing_id cleared.
- **Delete**: withdraws, deletes the offer and the inventory item, then removes the row.
- Every action writes a `bike_activity` entry (kind listing/eBay).
- `ebay-notifications` is a single global endpoint for eBay platform notifications. It stores nothing.

## 12. Errors we have hit

| Error | Cause | Fix |
|---|---|---|
| Invalid value for header Accept-Language | Wildcard header | Marketplace language headers (section 10) |
| Item specific Bike Type is missing | Aspect not sent | Bike Type mapping (section 6). Set a bike type. |
| Condition id invalid for category | Condition not allowed | `resolveCondition()` fallback |
| Description length should be 1–4000 | Full HTML sent to the inventory item | Plain summary on the inventory item, HTML on the offer |
| 20403 not opted in to business policies | Seller account setting | Opt in at ebay.co.uk/bp/manage |
| merchantLocationKey not found | No location | Created automatically by `ensureLocation()` |
| eBay needs these details… | Category's required aspects missing | Fill the named fields on the bike |

## 13. Who can list

Admin, owner and customer_service. Customer service can list, update and remove listings and edit asking or sale prices. They can't see costs or margins.

## Phase 1 accuracy updates (Sep 2026)

- **Despatch location** is set by each dealer in Settings → Integrations → eBay: location name (defaults to the dealership name), address line, town and postcode (town and postcode required, no default). Saving pushes it to eBay (`update_location_details` when it changes). Listing is blocked until it's set.
- **Condition description**: `condition_notes` go to eBay's condition box as plain text, max 1,000 characters, led by "InspectABike grade: X/5." when a grade exists. Empty notes give a warning.
- **Condition substitution**: never swaps to a better condition (the listing is blocked instead). Any swap is saved on `ebay_listings.condition_substituted_from/to`, logged in Activity and shown as an amber badge.
- **MPN**: sent only from the bike's own "Manufacturer part number (MPN)" field. Blank means nothing is sent. `{mpn}` is available in listing formats.
- **Brand**: trimmed and matched to eBay's spelling when the category provides a brand list.
- **Category cache**: item specifics and condition lookups are cached for 24 hours per category in `ebay_category_cache`.

## Phases 2–7 updates (Sep 2026)

- **Smart titles:** built in this order: make, model, groupset, frame material, bike type, key feature (Di2/eTap/AXS/Disc/Full Suspension/motor), size, wheel size (MTB/gravel), year. Repeated words are removed, shouting is tidied, and items later in the format are dropped to stay within 80 characters. Set a "Title format" under Listing Formats → eBay. Each bike can have a custom title on its eBay panel.
- **Item specifics:** filled from eBay's own list for the category (required and recommended), with values matched to eBay's choices (56 → 56 cm, M → Medium). Values that can't be matched are listed under "Couldn't match". Only required specifics block a listing. The duplicate "Type" is no longer sent.
- **Category order:** the bike's own category, then the category for its bike type (Settings → eBay, with a Suggest button), then the default.
- **Photos:** up to 24 are sent, with the chosen main photo first. You're warned under 6 photos or under 1600px. A photo under 500px blocks the listing.
- **Best Offer:** off by default. Auto-accept is 95% and auto-decline is 80% of the asking price (both editable). It can be switched on or off per bike.
- **Sale sync:** eBay orders are checked every 5 minutes. A sold bike is marked sold at the eBay price, taken off Shopify, logged in its activity, and the dealer is emailed. Each order is processed once (`ebay_orders`). Use "Mark despatched" on the bike's eBay panel to send the carrier and tracking to eBay. The sale invoice is still recorded by hand.
- **Promoted Listings:** switch on, set a default ad rate, and optionally promote every new listing. This uses one "VeloDealer auto" campaign per dealer, where you pay only when the item sells. Ads are removed when a listing ends.
- **Pre-publish checklist:** on the bike's eBay panel. Red items block listing and amber items warn.
- **Permissions:** connections made before this update must reconnect once to allow promotion (the card shows a banner).
