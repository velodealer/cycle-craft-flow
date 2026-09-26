# Show every 99Spokes part during search and review

## Goal
Make it possible to inspect and choose the complete component specification before applying a 99Spokes result, especially drivetrain and wheel details.

## Changes
- Expand the selected search result to show every supplied component, grouped into clear sections such as frame, wheels, drivetrain, brakes, cockpit, saddle and accessories.
- Show each part’s slot, brand, model, manufacturer part number, description and other supplied attributes without hiding long values.
- Include separate wheelset, front hub, rear hub and spokes details, rather than only the current wheelset summary.
- Include the complete drivetrain: crank, cassette, chain, front/rear derailleurs, shifters, bottom bracket, power meter and Di2/AXS battery when supplied.
- Replace the single combined “add components” checkbox in Review changes with selectable component rows, alongside the existing bike and specification values.
- Preselect missing parts; leave already-fitted slots unticked so existing confirmed parts are not replaced accidentally.
- When a fitted slot is explicitly selected, replace its saved bike-specific details with the newly selected 99Spokes part so stale details do not remain.
- Clearly distinguish “not supplied by 99Spokes” from a hidden or omitted part.

## Verification
- Test a record containing a multi-part drivetrain and branded wheelset/hubs.
- Confirm all source components appear in both the selected-result preview and Review changes.
- Confirm selected parts save and unselected fitted parts remain unchanged.
- Confirm brand, model, MPN, description and source attributes survive the save and display on the bike.
- Check the dialog on mobile and desktop, then run type and preview build checks.

## Technical notes
- Reuse the existing complete component mapping from the saved raw 99Spokes payload.
- Extend review rows to support component selections separately from bike columns and specification fields.
- No database schema change is expected.
