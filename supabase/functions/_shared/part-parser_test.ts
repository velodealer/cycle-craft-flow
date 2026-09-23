import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { parsePart, partDisplayName, resolveForSize, dedupeWords } from './part-parser.ts';
import { substituteHidingEmpty, partDetail } from './part-tokens.ts';

const bike = { bikeMake: 'Trek', bikeSize: '60cm', isElectric: false, bikeGroupset: 'Shimano 105 Di2' };
const p = (slot: string, text: string) => parsePart({ slot, text, ...bike });

Deno.test('part numbers come out of the text (the 8 agreed examples)', () => {
  const cases: Array<[string, string, string, string]> = [
    ['rear_derailleur', 'Shimano R7150 Di2, 36T max cog', '105 Di2', 'RD-R7150'],
    ['shifters', 'Shimano 105 R7170 Di2, 12 speed', '105 Di2', 'ST-R7170'],
    ['front_derailleur', 'Shimano 105 R7150 Di2, braze-on', '105 Di2', 'FD-R7150'],
    ['crank', 'Shimano 105 R7100, 50/34', '105', 'FC-R7100'],
    ['cassette', 'Shimano 105 7101, 11-34, 12 speed', '105', 'CS-R7101'],
    ['brakes', 'Shimano 105 hydraulic disc, BR-R7170 flat mount caliper', '105', 'BR-R7170'],
    ['disc_rotors', 'Shimano RT70, centerlock, 160mm', 'RT70', 'SM-RT70'],
    ['chain', 'Shimano SLX M7100, 12 speed', 'SLX', 'CN-M7100'],
  ];
  for (const [slot, text, model, mpn] of cases) {
    const r = p(slot, text);
    assertEquals([r.brand, r.model, r.mpn], ['Shimano', model, mpn], text);
  }
  assertEquals(p('brakes', 'Shimano 105 hydraulic disc, BR-R7170 flat mount caliper').mpn_inferred, false, 'BR- was in the text');
  assertEquals(p('crank', 'Shimano 105 R7100, 50/34').mpn_inferred, true, 'FC- prefix was added');
});

Deno.test('never invents a number that is not in the text', () => {
  const r = p('cassette', 'Shimano Ultegra, 11-speed, 11-34t');
  assertEquals(r.mpn, null);
  assertEquals(p('saddle', 'Bontrager Aeolus Comp, steel rails, 145mm width').mpn, null);
});

Deno.test('brand is never repeated, never the model, never a fragment', () => {
  const bars = p('handlebars', 'Size: 47, 50, Bontrager Elite Bontrager Elite VR-C, alloy, 31.8mm, 38cm width; Size: 60, 62, Bontrager Elite Bontrager Elite VR-C, alloy, 31.8mm, 44cm width');
  assertEquals([bars.brand, bars.model], ['Bontrager', 'Elite VR-C']);
  const post = p('seatpost', 'Size: 47, 50, 52, 54, Bontrager carbon seatmast cap, 20mm offset, short length; Size: 56, 58, 60, 62, Bontrager carbon seatmast cap, 20mm offset, tall length');
  assertEquals([post.brand, post.model, post.spec], ['Bontrager', 'carbon seatmast cap', '20mm offset, tall']);
  const frame = p('frame', 'Ultralight 500 Series OCLV Carbon, Ride Tuned performance tube optimization');
  assertEquals([frame.brand, frame.model], ['Trek', '500 Series OCLV Carbon']);
  const fork = p('fork', 'Émonda SL full carbon, tapered carbon steerer');
  assertEquals([fork.brand, fork.model, fork.spec], ['Trek', 'Émonda SL', 'full carbon']);
  const bb = p('bottom_bracket', 'Praxis, T47 threaded, internal bearing');
  assertEquals([bb.brand, bb.model], ['Praxis', 'T47 threaded']);
  const unknown = parsePart({ slot: 'pedals', text: 'Nylon, 105x78x28mm', bikeMake: 'Specialized' });
  assertEquals(unknown.brand, null);
  assert(unknown.flags.some((f) => f.includes('brand not recognised')));
});

Deno.test('per-size strings resolve to the bike size', () => {
  const crank = p('crank', 'Size: 47, Shimano 105 R7100, 50/34, 165mm length; Size: 60, 62, Shimano 105 R7100, 50/34, 175mm length');
  assertEquals(crank.spec, '50/34T, 175mm');
  const stem = p('stem', 'Size: 56, Bontrager Pro, 31.8mm, 7 degree, 100mm length; Size: 58, 60, 62, Bontrager Pro, 31.8mm, 7 degree, 110mm length');
  assertEquals([stem.model, stem.spec], ['Pro', '110mm, 7°']);
  assertEquals(resolveForSize('Giant Contact SL S:40cm, M:42cm, L:44cm', 'LG').text, 'Giant Contact SL 44cm');
  // size not in the list: other sizes' numbers must not leak in
  const xs = parsePart({ slot: 'stem', text: 'Giant Contact SL S:90mm, M:100mm, L:110mm', bikeSize: 'XS', bikeMake: 'Liv' });
  assertEquals(xs.spec, '');
});

Deno.test('Di2 battery on a non-e-bike moves out of ebike_battery', () => {
  assertEquals(p('ebike_battery', 'Shimano BT-DN300').slot, 'groupset_battery');
  assertEquals(parsePart({ slot: 'ebike_battery', text: 'Shimano BT-E8036', isElectric: true }).slot, 'ebike_battery');
});

Deno.test('library speed conflict is flagged and the bike text wins', () => {
  const r = parsePart({ slot: 'cassette', text: 'Shimano 105 7101, 11-34, 12 speed', libraryAttributes: { speeds: 11 } });
  assertEquals(r.attributes.speeds, 12);
  assert(r.flags.some((f) => f.includes('library says 11 speed')));
});

Deno.test('display name de-duplicates brand/model/mpn', () => {
  assertEquals(partDisplayName('Shimano', '105 Di2', 'RD-R7150'), 'Shimano 105 Di2 RD-R7150');
  assertEquals(partDisplayName('Shimano', 'RT70', 'SM-RT70'), 'Shimano SM-RT70');
  assertEquals(partDisplayName('Bontrager', 'Bontrager', null), 'Bontrager');
  assertEquals(dedupeWords('Bontrager Elite Bontrager Elite VR-C'), 'Bontrager Elite VR-C');
});

Deno.test('detail never repeats the name or itself', () => {
  const legacy = { brand: 'Shimano', model: 'SLX', description: 'Shimano SLX M7100, 12 speed', notes: 'Shimano SLX M7100, 12 speed' };
  assertEquals(partDetail(legacy), 'Shimano SLX M7100, 12 speed');
  assertEquals(partDetail({ ...legacy, spec_overrides: { spec: '12 speed' } }), '12 speed');
});

Deno.test('empty rows and empty groups are hidden', () => {
  const tpl = '<div class="g"><h3>Frameset</h3><dl><div class="r"><dt>Frame</dt><dd>{a}</dd></div></dl></div>' +
    '<div class="g"><h3>Groupset</h3><dl><div class="r"><dt>Crank</dt><dd>{b}</dd></div><div class="r"><dt>Chain</dt><dd>{c}</dd></div></dl></div>';
  const out = substituteHidingEmpty(tpl, { a: '', b: 'Shimano 105', c: '' });
  assert(!out.includes('Frameset'), 'empty group removed');
  assert(out.includes('Shimano 105'));
  assert(!out.includes('Chain'), 'empty row removed');
  assertEquals(substituteHidingEmpty('Frame: {a}\nCrank: {b}', { a: '', b: 'X' }, 'text'), 'Crank: X');
});
