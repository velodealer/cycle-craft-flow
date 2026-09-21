// Lists, updates, sells out or removes a single bike on the connected Shopify store.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { serviceClient, requireUser, requireRole } from '../_shared/shopify.ts';
import {
  pushBikeToShopify,
  markBikeSoldOut,
  deleteShopifyProduct,
  recordListingError,
} from '../_shared/shopify-listing.ts';
import { logBikeActivity } from '../_shared/activity.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const STAFF = ['admin', 'owner', 'mechanic', 'detailer', 'accountant', 'social_manager'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = serviceClient();

  try {
    const user = await requireUser(req, supabase);
    await requireRole(supabase, user.id, STAFF);
  } catch (e) {
    return json({ error: (e as Error).message }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const bikeId = String(body.bike_id ?? '');
  const action = String(body.action ?? 'list');
  if (!bikeId) return json({ error: 'bike_id is required' }, 400);

  try {
    if (action === 'unlist') {
      const removed = await deleteShopifyProduct(supabase, bikeId);
      if (removed) {
        await logBikeActivity(bikeId, {
          kind: 'listing',
          action: 'removed',
          summary: 'Shopify listing removed',
          actorLabel: 'Shopify',
        });
      }
      return json({ ok: true, removed });
    }

    if (action === 'sold_out') {
      const updated = await markBikeSoldOut(supabase, bikeId);
      if (updated) {
        await logBikeActivity(bikeId, {
          kind: 'listing',
          action: 'sold_out',
          summary: 'Shopify listing marked sold out',
          actorLabel: 'Shopify',
        });
      }
      return json({ ok: true, updated });
    }

    const { data: bike, error } = await supabase
      .from('bikes')
      .select('*')
      .eq('id', bikeId)
      .maybeSingle();
    if (error || !bike) return json({ error: 'Bike not found' }, 404);

    const result = await pushBikeToShopify(supabase, bike as any, 1);
    await logBikeActivity(bikeId, {
      kind: 'listing',
      action: 'listed',
      summary: 'Listed on Shopify',
      detail: { product_id: result.productId, url: result.url },
      actorLabel: 'Shopify',
    }, (bike as any).business_id);
    return json({ ok: true, product_id: result.productId, url: result.url });
  } catch (e) {
    const message = (e as Error).message;
    console.error('shopify-sync-bike failed:', message);
    await recordListingError(supabase, bikeId, message);
    await logBikeActivity(bikeId, {
      kind: 'listing',
      action: 'failed',
      summary: 'Shopify listing failed',
      detail: { note: message },
      actorLabel: 'Shopify',
    });
    return json({ error: message }, 400);
  }
});
