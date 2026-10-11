# Combine bike logistics into one section

## Goal
Replace the separate Collection Status and Delivery Status cards on each individual bike page with one clear **Logistics** section.

## Changes
- Add one Logistics card on the bike page.
- Show **Collection** and **Delivery** as two labelled entries inside that card when both exist.
- Keep each entry’s existing status, tracking number, scheduled date, contact/address details, instructions, errors, and retry action.
- When one or both journeys have not been linked, show the relevant **Link existing collection** and/or **Link existing delivery** actions inside the same section.
- Keep all current Cycle Courier queries, linking, retrying, and update behaviour unchanged.
- Make the combined layout stack cleanly on smaller screens and remain easy to scan on desktop.

## Technical details
- Refactor the current bike logistics display so the shared outer card is rendered once by the bike detail view.
- Reuse a direction-specific collection/delivery detail component for the two inner entries, avoiding duplicate data-loading logic.
- Verify the bike page in these states: no journeys, collection only, delivery only, and both collection and delivery present.