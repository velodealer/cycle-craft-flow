import { assert, assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { fetchBikeComponents, BIKE_COMPONENTS_SELECT, isPartsFetchError } from './bike-components.ts';
import { renderTemplate } from './listing-template.ts';

// Real columns of public.components (checked 2026-09-23). The fake client rejects any
// embedded column not in this list with PostgREST's 42703 — exactly what hit production.
const COMPONENT_COLUMNS = new Set(['id', 'category_id', 'brand', 'model', 'mpn', 'description', 'weight_g', 'attributes', 'created_at', 'updated_at', 'business_id']);

function fakeClient(rows: any[]) {
  return {
    from: () => ({
      select: (sel: string) => ({
        eq: async () => {
          const inner = sel.match(/components\(([^()]*(?:\([^)]*\))?[^()]*)\)/)?.[1] ?? '';
          const cols = inner.replace(/\w+\([^)]*\)/g, '').split(',').map((s) => s.trim()).filter(Boolean);
          const bad = cols.find((c) => !COMPONENT_COLUMNS.has(c));
          if (bad) return { data: null, error: { code: '42703', message: `column components_1.${bad} does not exist` } };
          return { data: rows, error: null };
        },
      }),
    }),
  };
}

const ROWS = [
  { slot: 'shifters', notes: null, components: { brand: 'Shimano', model: '105 Di2', mpn: null, weight_g: null, description: 'Shimano 105 R7170 Di2, 12 speed', attributes: {}, component_categories: { name: 'Shifters' } } },
  { slot: 'wheelset', notes: null, components: { brand: 'Bontrager', model: 'Aeolus Elite', mpn: null, weight_g: null, description: null, attributes: {}, component_categories: { name: 'Wheels' } } },
];

Deno.test('select only names columns that exist on components', () => {
  assert(!/\bname\b,/.test(BIKE_COMPONENTS_SELECT.replace('component_categories(name)', '')));
});

Deno.test('regression: known fitted parts render non-empty part tokens', async () => {
  const parts = await fetchBikeComponents(fakeClient(ROWS), 'bike-1');
  const out = renderTemplate('[{part_shifters}] [{part_wheelset}] [{part_shifters_detail}]', { make: 'Trek' }, parts);
  assertEquals(out, '[Shimano 105 Di2] [Bontrager Aeolus Elite] [Shimano 105 R7170 Di2, 12 speed]');
});

Deno.test('a failed fetch throws PartsFetchError, never []', async () => {
  const broken = fakeClient(ROWS);
  const orig = broken.from;
  broken.from = () => ({ select: () => orig().select('slot, components(name, brand)') }) as any;
  const err = await assertRejects(() => fetchBikeComponents(broken, 'bike-1'));
  assert(isPartsFetchError(err));
  assert(String((err as Error).message).includes('42703'));
});

Deno.test('genuinely zero parts resolves to []', async () => {
  assertEquals(await fetchBikeComponents(fakeClient([]), 'bike-1'), []);
});

// Live check against the real database when a service key is available.
const URL_ = Deno.env.get('SUPABASE_URL');
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
Deno.test({
  name: 'live: BPS-TRE-027T part tokens are non-empty',
  ignore: !URL_ || !KEY,
  fn: async () => {
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const sb = createClient(URL_!, KEY!);
    const { data: bike } = await sb.from('bikes').select('*').eq('reference', 'BPS-TRE-027T').single();
    const parts = await fetchBikeComponents(sb, bike.id);
    assert(parts.length > 0);
    const out = renderTemplate('{part_shifters}|{part_crank}|{part_wheelset}', bike, parts);
    assert(out.split('|').every((v) => v.trim().length > 0), out);
  },
});
