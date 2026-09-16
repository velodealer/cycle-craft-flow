// Lists, updates, ends or removes a single bike on the connected eBay account.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { serviceClient, requireUser, requireRole } from '../_shared/ebay.ts';
import {
  pushBikeToEbay,
  endEbayListing,
  deleteEbayListing,
  recordListingError,
} from '../_shared/ebay-listing.ts';

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
    if (action === 'end') {
      const ended = await endEbayListing(supabase, bikeId);
      return json({ ok: true, ended });
    }

    if (action === 'remove') {
      const removed = await deleteEbayListing(supabase, bikeId);
      return json({ ok: true, removed });
    }

    const { data: bike, error } = await supabase
      .from('bikes')
      .select('*')
      .eq('id', bikeId)
      .maybeSingle();
    if (error || !bike) return json({ error: 'Bike not found' }, 404);

    const result = await pushBikeToEbay(supabase, bike as any);
    return json({ ok: true, offer_id: result.offerId, listing_id: result.listingId, url: result.url });
  } catch (e) {
    const message = (e as Error).message;
    console.error('ebay-sync-bike failed:', message);
    await recordListingError(supabase, bikeId, message);
    return json({ error: message }, 400);
  }
});
