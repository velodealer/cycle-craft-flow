import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { canContinueToListing, firstMissingIndex, orderedCaptured, photoPath, squareCrop } from '../../../src/lib/photoGuideRules.ts';

const shots = Array.from({ length: 18 }, (_, i) => ({ n: i + 1, id: `s${i + 1}` }));
const all = (status: 'captured' | 'skipped') => shots.map((s) => ({ shot_id: s.id, status }));

Deno.test('continue needs every shot captured or skipped', () => {
  assertEquals(canContinueToListing(shots, all('captured').slice(0, 17)), false);
  assertEquals(canContinueToListing(shots, all('captured')), true);
});

Deno.test('shots 1-3 cannot be skipped, shot 4 can', () => {
  const recs = all('captured');
  recs[2] = { shot_id: 's3', status: 'skipped' };
  assertEquals(canContinueToListing(shots, recs), false);
  const recs2 = all('captured');
  recs2[3] = { shot_id: 's4', status: 'skipped' };
  assertEquals(canContinueToListing(shots, recs2), true);
});

Deno.test('first missing shot and listing order', () => {
  assertEquals(firstMissingIndex(shots, [{ shot_id: 's1', status: 'captured' }]), 1);
  const rows = [{ status: 'captured', shot_number: 5 }, { status: 'skipped', shot_number: 2 }, { status: 'captured', shot_number: 1 }];
  assertEquals(orderedCaptured(rows).map((r) => r.shot_number), [1, 5]);
});

Deno.test('path and square crop', () => {
  assertEquals(photoPath('b', 'k', { n: 8, id: 'top-tube-stem' }), 'b/k/08-top-tube-stem.jpg');
  assertEquals(squareCrop(3840, 2160), { sx: 840, sy: 0, side: 2160, out: 2048 });
});
