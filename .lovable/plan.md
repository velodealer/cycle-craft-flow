# Fix eBay notification verification

## Confirmed cause
The latest eBay test requests reach VeloDealer, but signature verification returns HTTP 412 because the public key fetched from eBay is a raw Base64 EC key rather than a complete PEM document. The current code only adjusts line breaks when PEM markers already exist; it does not add the missing `BEGIN PUBLIC KEY` and `END PUBLIC KEY` markers, so Node reports `invalid PEM public key`.

## Changes
1. Normalize eBay’s returned key into a valid PEM public key:
   - preserve an already-valid PEM;
   - otherwise strip whitespace, wrap the Base64 body at standard line lengths, and add the required PEM markers;
   - reject malformed or empty key responses clearly.
2. Verify the ECDSA/SHA-1 signature against the exact raw request body, preserving the existing 412 response only for genuinely invalid signatures.
3. Add focused tests for raw Base64 keys, existing PEM keys, malformed keys, valid signatures, and invalid signatures.
4. Deploy the corrected `ebay-notifications` function and test its challenge response.
5. Ask for one final **Send Test Notification**, then check the live logs for a verified request and HTTP 204.

## Safety
No database migration or bike/listing data changes. Automatic listing remains paused.
