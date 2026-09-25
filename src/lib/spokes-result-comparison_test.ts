import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { colourSummary, differingDetails, similarSpokesKey, spokesModelName } from './spokes-result-comparison.ts';

Deno.test('removes a repeated family from a 99spokes result name', () => {
  assertEquals(spokesModelName({ family: 'Madone', model: 'Madone SL 6' }), 'Madone SL 6');
  assertEquals(spokesModelName({ family: 'Domane', model: 'SL 6' }), 'Domane SL 6');
});

Deno.test('groups Disc suffix variants but keeps unrelated models separate', () => {
  const base = { maker: 'Trek', year: 2020, family: 'Madone', model: 'Madone SL 6' };
  assertEquals(similarSpokesKey(base), similarSpokesKey({ ...base, model: 'Madone SL 6 Disc' }));
  if (similarSpokesKey(base) === similarSpokesKey({ ...base, model: 'Madone SL 7' })) throw new Error('Different models were grouped');
});

Deno.test('shows only differing component fields for a similar group', () => {
  assertEquals(differingDetails([
    { brakes: 'Shimano Ultegra', cassette: '11-30' },
    { brakes: 'Shimano Dura-Ace', cassette: '11-28 / 11-30' },
  ]), { brakes: true, cassette: true, showColour: true });
  assertEquals(differingDetails([{ brakes: 'Ultegra' }]), { brakes: false, cassette: false, showColour: false });
});

Deno.test('states when 99spokes supplies no colour', () => {
  assertEquals(colourSummary(null), 'Colour not supplied');
  assertEquals(colourSummary(['Red', 'Black']), 'Red, Black');
});