// TEMPORARY read-only snapshot for Checkpoint 0.5 — deleted immediately after use.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { loadBikeComponents, loadListingTemplate, buildValues, renderTemplate } from '../_shared/listing-template.ts';
Deno.serve(async (req) => {
  const { token } = await req.json().catch(() => ({}));
  if (token !== 'af412a37b9c4c7dafd13d38caa49d0ac') return new Response('no', { status: 403 });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: bike, error } = await sb.from('bikes').select('*').eq('reference', 'BPS-TRE-027T').single();
  if (error) return new Response(JSON.stringify({ error }), { status: 500 });
  const components = await loadBikeComponents(sb, bike.id);
  const tpl = await loadListingTemplate(sb, 'ebay', bike.business_id);
  const tokens = [...new Set([...(tpl?.body ?? '').matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
  const values = buildValues(bike, components);
  const rendered = Object.fromEntries(tokens.map((t) => [t, renderTemplate('{' + t + '}', bike, components)]));
  delete (bike as any).catalog_data;
  return new Response(JSON.stringify({ bike, components, tokens, rendered, knownKeys: Object.keys(values).length }));
});
