// Lists, ends or removes a stock part on eBay or Shopify for the caller's dealership.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { serviceClient, requireUser, requireRole, businessIdForUser } from '../_shared/ebay.ts';
import { pushPartToEbay, endPartOnEbay, pushPartToShopify, removePartFromShopify, delistPartEverywhere } from '../_shared/part-listing.ts';
import { logSystemError } from '../_shared/system-error.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const STAFF = ['admin', 'owner', 'mechanic', 'accountant', 'customer_service'];
const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = serviceClient();
  let businessId: string;
  try {
    const user = await requireUser(req, supabase);
    await requireRole(supabase, user.id, STAFF);
    businessId = await businessIdForUser(supabase, user.id);
  } catch (e) {
    return json({ error: (e as Error).message }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const partId = String(body.part_id ?? '');
  const channel = String(body.channel ?? '');
  const action = String(body.action ?? 'list');
  if (!UUID.test(partId)) return json({ error: 'part_id is required' }, 400);
  if (!['ebay', 'shopify', 'all'].includes(channel)) return json({ error: 'channel must be ebay, shopify or all' }, 400);
  if (!['list', 'end', 'delist_sold'].includes(action)) return json({ error: 'Unknown action' }, 400);

  const { data: part } = await supabase.from('parts').select('*').eq('id', partId).maybeSingle();
  // Tenant check: a part from another dealership looks exactly like a missing one.
  if (!part || (part as any).business_id !== businessId) return json({ error: 'Part not found' }, 404);

  if (action === 'delist_sold') {
    const notes = await delistPartEverywhere(supabase, partId, 'manual');
    return json({ ok: true, notes });
  }

  try {
    if (channel === 'ebay') {
      if (action === 'end') return json({ ok: true, ended: await endPartOnEbay(supabase, part) });
      return json({ ok: true, ...(await pushPartToEbay(supabase, part)) });
    }
    if (channel === 'shopify') {
      if (action === 'end') return json({ ok: true, removed: await removePartFromShopify(supabase, part) });
      return json({ ok: true, ...(await pushPartToShopify(supabase, part)) });
    }
    return json({ error: 'Pick one channel' }, 400);
  } catch (e) {
    const message = (e as Error).message;
    const col = channel === 'ebay' ? 'ebay_last_error' : 'shopify_last_error';
    await supabase.from('parts').update({ [col]: message.slice(0, 500) } as any).eq('id', partId);
    await logSystemError(supabase, { source: channel, message, businessId, detail: { operation: `part_${action}`, part_id: partId } });
    return json({ error: message }, 400);
  }
});
