import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { neutraliseFormula } from '../../../src/lib/csvSafe.ts';

Deno.test('formula-like text gets an apostrophe', () => {
  assertEquals(neutraliseFormula('=HYPERLINK("x")'), `'=HYPERLINK("x")`);
  assertEquals(neutraliseFormula('@SUM(A1)'), `'@SUM(A1)`);
  assertEquals(neutraliseFormula('+cmd'), `'+cmd`);
});
Deno.test('numbers and normal text are unchanged', () => {
  assertEquals(neutraliseFormula('-150.50'), '-150.50');
  assertEquals(neutraliseFormula('Road bike'), 'Road bike');
});
