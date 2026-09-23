// Lists/updates, sells out or removes one bike on the dealership's Squarespace store.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { serviceClient, requireUser, requireRole, businessIdForUser, businessIdForBike } from '../_shared/squarespace.ts';
import { pushBikeToSquarespace, markSquarespaceSoldOut, removeSquarespaceProduct } from '../_shared/squarespace-listing.ts';
import { logBikeActivity } from '../_shared/activity.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const STAFF = ['admin', 'owner', 'mechanic', 'detailer', 'accountant', 'social_manager', 'customer_service'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = serviceClient();

  let userId: string;
  const body = await req.json().catch(() => ({}));
  const bikeId = String(body.bike_id ?? '');
  const action = String(body.action ?? 'list');
  if (!/^[0-9a-f-]{36}$/i.test(bikeId)) return json({ error: 'bike_id is required' }, 400);

  try {
    const user = await requireUser(req, supabase);
    await requireRole(supabase, user.id, STAFF);
    userId = user.id;
    const [mine, bikes] = await Promise.all([businessIdForUser(supabase, user.id), businessIdForBike(supabase, bikeId)]);
    if (mine !== bikes) throw new Error('Bike not found');
  } catch (e) {
    return json({ error: (e as Error).message }, 401);
  }

  try {
    if (action === 'unlist') {
      const removed = await removeSquarespaceProduct(supabase, bikeId);
      if (removed) await logBikeActivity(bikeId, { kind: 'listing', action: 'removed', summary: 'Squarespace listing removed', actorId: userId, actorLabel: 'Squarespace' });
      return json({ ok: true, removed });
    }
    if (action === 'sold_out') {
      const updated = await markSquarespaceSoldOut(supabase, bikeId);
      if (updated) await logBikeActivity(bikeId, { kind: 'listing', action: 'sold_out', summary: 'Marked sold out on Squarespace', actorId: userId, actorLabel: 'Squarespace' });
      return json({ ok: true, updated });
    }
    const res = await pushBikeToSquarespace(supabase, bikeId, 1);
    await logBikeActivity(bikeId, {
      kind: 'listing', action: 'listed', summary: 'Listed / updated on Squarespace',
      detail: { product_id: res.productId, url: res.url }, actorId: userId, actorLabel: 'Squarespace',
    });
    return json({ ok: true, url: res.url, product_id: res.productId });
  } catch (e) {
    console.error('squarespace-sync-bike error:', (e as Error).message);
    return json({ error: (e as Error).message }, 400);
  }
});
