// Every channel (eBay, Shopify, Squarespace, CSV) must build the same base title,
// differing only by each channel's length cap and prefix/suffix.
import { assertEquals } from 'jsr:@std/assert';
import { finalEbayTitle, buildEbayTitle } from '../_shared/ebay-title.ts';

const bike = {
  id: 'b1',
  make: 'Canyon',
  model: 'Aeroad CF SL',
  year: 2021,
  size: '56',
  colour: 'Grey',
  bike_type: 'road',
  frame_material: 'Carbon',
  spec_values: { drivetrain: { groupset: 'Shimano Ultegra Di2' } },
};

Deno.test('all channels share the same base title', () => {
  const base = finalEbayTitle(bike, null, null);
  // eBay caps at 80, Shopify 255, Squarespace 200 — same string, different caps.
  assertEquals(base, finalEbayTitle(bike, null, null).slice(0, 255));
  assertEquals(base, finalEbayTitle(bike, null, null).slice(0, 200));
  assertEquals(base, 'Canyon Aeroad CF SL Shimano Ultegra Di2 Carbon Road Bike 56cm 2021');
});

Deno.test('a per-bike custom title wins on every channel', () => {
  const override = 'My custom listing title';
  assertEquals(finalEbayTitle(bike, null, override), override);
  assertEquals(finalEbayTitle(bike, '{make} {model}', override), override);
});

Deno.test('dealer title template drives the shared title', () => {
  assertEquals(buildEbayTitle(bike, '{year} {make} {model} {colour}'), '2021 Canyon Aeroad CF SL Grey');
});
