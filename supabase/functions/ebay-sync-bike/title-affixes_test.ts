import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { applyTitleAffixes, normaliseChannelSettings } from '../_shared/channel-pricing.ts';

Deno.test('blank affixes leave the title unchanged (capped)', () => {
  assertEquals(applyTitleAffixes('Trek Madone SL 6', undefined, 80), 'Trek Madone SL 6');
  assertEquals(applyTitleAffixes('x'.repeat(100), { prefix: '', suffix: '' }, 80).length, 80);
});

Deno.test('prefix and suffix wrap the title with single spaces', () => {
  assertEquals(
    applyTitleAffixes('Trek Madone SL 6', { prefix: 'BPS Certified', suffix: 'Free UK Delivery' }, 80),
    'BPS Certified Trek Madone SL 6 Free UK Delivery',
  );
});

Deno.test('long titles are shortened in the middle so affixes survive', () => {
  const out = applyTitleAffixes('Trek Madone SL 6 Disc Carbon Road Bike Shimano Ultegra Di2 56cm 2021 Excellent Condition', { prefix: 'BPS', suffix: 'Warranty Included' }, 80);
  assertEquals(out.startsWith('BPS '), true);
  assertEquals(out.endsWith(' Warranty Included'), true);
  assertEquals(out.length <= 80, true);
  assertEquals(/  /.test(out), false);
});

Deno.test('affixes are trimmed, whitespace-collapsed and capped at 40 chars', () => {
  const s = normaliseChannelSettings({ affixes: { ebay: { prefix: '  BPS   Certified  ', suffix: 'y'.repeat(60) } } });
  assertEquals(s.affixes.ebay.prefix, 'BPS Certified');
  assertEquals(s.affixes.ebay.suffix.length, 40);
  assertEquals(s.affixes.shopify, { prefix: '', suffix: '' });
});
