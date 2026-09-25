# Show differences between similar 99spokes results

## What will change
- Keep both 99spokes records when they have different IDs, rather than hiding or merging either one.
- For similar results, show the useful differences directly on each option: brake specification, cassette, available colours, and any other differing component summary supplied by 99spokes.
- When 99spokes supplies no colour, say “Colour not supplied” rather than implying the records are different colours.
- Keep the result cards compact and readable on phones, with the differing values visually emphasised.
- Remove repeated family wording in result names, so this example reads “2020 Trek Madone SL 6” rather than “2020 Trek Madone Madone SL 6”.

## This example
The two records will remain selectable because they have separate 99spokes IDs. Their cards will make clear that:
- both use the same image and have no colour data;
- both are disc-brake bikes with an Ultegra drivetrain and Aeolus Comp wheels;
- the “Disc” record contains a mixed Ultegra/Dura-Ace brake description and size-dependent cassette details, while the plain record has a fixed Ultegra brake and 11–30 cassette specification.

## Technical details
- Extend the existing 99spokes search-result mapping with compact brake, cassette, and colour summaries from the component data already requested by the search.
- Identify near-matching results by maker, year, and normalised model name, then display only fields that differ within that group.
- Reuse the existing family/model de-duplication rule for search-result and selected-result headings.
- Add focused tests for the Madone pair, missing colour data, identical fields, and repeated family names.
- No database changes and no changes to how a selected bike is saved.
