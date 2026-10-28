import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  cycleCourierFetch,
  extractCourierStatus,
  extractTrackingNumber,
  shouldApplyStatus,
} from '../_shared/cycle-courier.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: auth } = await supabase.auth.getUser(token);
    if (!auth.user) return json({ error: 'Unauthorized' }, 401);
    const body = await req.json().catch(() => ({}));
    const collectionId = body?.collection_id;
    const { data: profile } = await supabase.from('profiles').select('business_id').eq('user_id', auth.user.id).maybeSingle();
    if (!profile?.business_id) return json({ error: 'No dealership account' }, 403);
    const syncOne = async (collection: any) => {
      const response = await cycleCourierFetch(supabase as any, collection.business_id, `/orders/${encodeURIComponent(collection.order_id)}`, { method: 'GET' });
      if (!response.ok) throw new Error(`Cycle Courier returned ${response.status}`);
      const payload = await response.json();
      const order = payload?.order ?? payload?.data ?? payload;
      console.log('cycle-courier-order-sync order:', collection.order_id);
      const remoteStatus = extractCourierStatus(order);
      const tracking = extractTrackingNumber(order) ?? collection.tracking_number;
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const applyStatus = shouldApplyStatus(collection.status, remoteStatus);
      if (applyStatus) update.status = remoteStatus;
      if (tracking) update.tracking_number = String(tracking);
      if (remoteStatus === 'delivered') update.completed_at = order?.deliveredAt ?? order?.completedAt ?? new Date().toISOString();
      const { error } = await supabase.from('bike_collections').update(update).eq('id', collection.id);
      if (error) throw error;
      if (applyStatus && remoteStatus === 'delivered' && collection.bike_id) {
        await supabase
          .from('bikes')
          .update({ status: collection.direction === 'outbound' ? 'delivered' : 'intake' })
          .eq('id', collection.bike_id);
      }

      return { id: collection.id, status: applyStatus ? remoteStatus : collection.status, tracking_number: tracking };
    };
    const cols = 'id, order_id, business_id, tracking_number, status, direction, bike_id';
    if (body?.all) {
      const { data: open } = await supabase.from('bike_collections').select(cols)
        .eq('business_id', profile.business_id).not('order_id', 'is', null)
        .not('status', 'in', '(delivered,cancelled)');
      const results: any[] = [];
      for (const c of open ?? []) {
        try { results.push(await syncOne(c)); } catch (err) { results.push({ id: c.id, error: (err as Error).message }); }
      }
      return json({ ok: true, checked: results.length, results });
    }
    const { data: collection } = await supabase.from('bike_collections').select(cols)
      .eq('id', collectionId).eq('business_id', profile.business_id).maybeSingle();
    if (!collection?.order_id) return json({ error: 'Courier order not found' }, 404);
    const r = await syncOne(collection);
    return json({ ok: true, status: r.status, tracking_number: r.tracking_number });

  } catch (error) {
    console.error('cycle-courier-order-sync:', (error as Error).message);
    return json({ error: (error as Error).message }, 500);
  }
});