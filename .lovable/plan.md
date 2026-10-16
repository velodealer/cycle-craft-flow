# Remove the condition grade from the eBay listing

## Why "Wheels" shows on the website
The screenshot comes from your website (Shopify), not eBay. Your Shopify product page lays out its own Condition report, and that layout includes the Wheels field. For BPS-BMC-1044, VeloDealer fills Wheels with the fitted wheelset ("BMC XRD 522 XRD-522"). The label and where it appears are set in your Shopify theme, not in VeloDealer. To take Wheels out of that section, edit the product page in Shopify (Online Store > Themes > Customise > product template) and remove or move the Wheels block. VeloDealer doesn't need to change for this.

## Change: stop showing the grade on eBay
- In your saved eBay listing format, delete the grade line (`<p class="grade">{condition}</p>`) from the Condition report section.
- The condition notes and the "Checked in our workshop" box stay as they are.
- The eBay condition setting itself (Used) doesn't change. eBay requires it, and it isn't shown in the description.
- Then re-sync BPS-BMC-1044 so its live listing picks up the change. Other listed bikes will update the next time they sync.

## Technical details
- Edit only the `listing_templates` row (platform `ebay`, this dealership) to remove the `{condition}` grade paragraph. No code changes.
- Check afterwards that the saved template no longer contains `class="grade"`.
