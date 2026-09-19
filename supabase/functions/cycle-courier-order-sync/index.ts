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
    const { collection_id: collectionId } = await req.json();
    const { data: profile } = await supabase.from('profiles').select('business_id').eq('user_id', auth.user.id).maybeSingle();
    if (!profile?.business_id) return json({ error: 'No dealership account' }, 403);
    const { data: collection } = await supabase
      .from('bike_collections')
      .select('id, order_id, business_id, tracking_number, status')
      .eq('id', collectionId)
      .eq('business_id', profile.business_id)
      .maybeSingle();
    if (!collection?.order_id) return json({ error: 'Courier order not found' }, 404);
    const response = await cycleCourierFetch(supabase as any, collection.business_id, `/orders/${encodeURIComponent(collection.order_id)}`, { method: 'GET' });
    if (!response.ok) return json({ error: `Cycle Courier returned ${response.status}` }, response.status);
    const payload = await response.json();
    const order = payload?.order ?? payload?.data ?? payload;
    const remoteStatus = normaliseStatus(order?.status ?? order?.deliveryStatus);
    const tracking = order?.trackingNumber ?? order?.tracking_number ?? order?.tracking?.number ?? order?.shipment?.trackingNumber ?? collection.tracking_number;
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (remoteStatus) update.status = remoteStatus;
    if (tracking) update.tracking_number = String(tracking);
    if (remoteStatus === 'delivered') update.completed_at = order?.deliveredAt ?? order?.completedAt ?? new Date().toISOString();
    const { error } = await supabase.from('bike_collections').update(update).eq('id', collection.id);
    if (error) throw error;
    return json({ ok: true, status: remoteStatus, tracking_number: tracking });
  } catch (error) {
    console.error('cycle-courier-order-sync:', (error as Error).message);
    return json({ error: (error as Error).message }, 500);
  }
});