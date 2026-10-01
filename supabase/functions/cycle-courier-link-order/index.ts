import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import {
  cycleCourierFetch,
  extractCourierStatus,
  extractParty,
  extractTrackingNumber,
  ReconnectRequired,
} from '../_shared/cycle-courier.ts';
import { logBikeActivity } from '../_shared/activity.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const Body = z.object({
  bike_id: z.string().uuid(),
  direction: z.enum(['inbound', 'outbound']),
  order: z.string().trim().min(1).max(500),
});

/** Pulls the order id out of a booking/tracking link, or returns the bare value. */
export function parseOrderRef(input: string): string {
  const value = input.trim();
  try {
    const url = new URL(value);
    const parts = url.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex((p) => ['orders', 'order', 'track', 'tracking'].includes(p.toLowerCase()));
    if (idx >= 0 && parts[idx + 1]) return decodeURIComponent(parts[idx + 1]);
    const q = url.searchParams.get('order') ?? url.searchParams.get('id') ?? url.searchParams.get('tracking');
    if (q) return q;
    return decodeURIComponent(parts[parts.length - 1] ?? '');
  } catch {
    return value;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: auth } = await supabase.auth.getUser(token);
    if (!auth.user) return json({ error: 'Unauthorized' }, 401);
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: 'Pick a bike, a direction and paste the order link.' }, 400);
    const { bike_id, direction } = parsed.data;
    const ref = parseOrderRef(parsed.data.order);
    if (!ref) return json({ error: 'Could not read an order number from that link.' }, 400);

    const { data: profile } = await supabase.from('profiles').select('business_id, role').eq('user_id', auth.user.id).maybeSingle();
    if (!profile?.business_id) return json({ error: 'No dealership account' }, 403);
    const businessId = profile.business_id as string;

    const { data: bike } = await supabase.from('bikes').select('id, reference, make, model').eq('id', bike_id).eq('business_id', businessId).maybeSingle();
    if (!bike) return json({ error: 'Bike not found' }, 404);

    const response = await cycleCourierFetch(supabase as any, businessId, `/orders/${encodeURIComponent(ref)}`, { method: 'GET' });
    if (response.status === 404 || response.status === 403) {
      return json({ error: 'That order was not found on your Cycle Courier Co account. Paste the order link from your Cycle Courier bookings page.' }, 404);
    }
    if (!response.ok) return json({ error: `Cycle Courier returned ${response.status}` }, 502);
    const payload = await response.json();
    const order = payload?.order ?? payload?.data ?? payload;
    const orderId = String(order?.id ?? order?.orderId ?? order?.order_id ?? ref);

    const { data: existing } = await supabase
      .from('bike_collections')
      .select('id, bike_id, bikes(reference)')
      .eq('business_id', businessId)
      .eq('order_id', orderId)
      .maybeSingle();
    if (existing) {
      const r = (existing as any).bikes?.reference ?? 'another bike';
      return json({ error: `This order is already linked to ${r}.` }, 409);
    }

    const status = extractCourierStatus(order) || 'scheduled';
    const tracking = extractTrackingNumber(order);
    const sender = extractParty(order, 'sender');
    const receiver = extractParty(order, 'receiver');
    const now = new Date().toISOString();

    const { data: row, error } = await supabase.from('bike_collections').insert({
      business_id: businessId,
      bike_id,
      direction,
      order_id: orderId,
      tracking_number: tracking,
      status,
      sender_name: sender.name ?? '',
      sender_email: sender.email ?? '',
      sender_phone: sender.phone ?? '',
      address_street: sender.street ?? '',
      address_city: sender.city ?? '',
      address_postcode: sender.postcode ?? '',
      address_country: sender.country ?? 'GB',
      receiver_name: receiver.name,
      receiver_email: receiver.email,
      receiver_phone: receiver.phone,
      receiver_street: receiver.street,
      receiver_city: receiver.city,
      receiver_postcode: receiver.postcode,
      receiver_country: receiver.country,
      scheduled_date: order?.scheduledDate ?? order?.scheduled_date ?? null,
      completed_at: status === 'delivered' ? (order?.deliveredAt ?? order?.completedAt ?? now) : null,
    }).select('id').single();
    if (error) throw error;

    let bikeStatus: string | null = null;
    if (status === 'delivered') bikeStatus = direction === 'outbound' ? 'delivered' : 'intake';
    else if (status === 'collected' && direction === 'outbound') bikeStatus = 'collected';
    if (bikeStatus) await supabase.from('bikes').update({ status: bikeStatus }).eq('id', bike_id);

    await logBikeActivity(bike_id, {
      kind: 'logistics',
      action: 'courier_order_linked',
      summary: `Linked existing Cycle Courier ${direction === 'outbound' ? 'delivery' : 'collection'} order${tracking ? ` (${tracking})` : ''}`,
      detail: { order_id: orderId, tracking_number: tracking, status },
      actorId: auth.user.id,
    }, businessId);

    return json({ ok: true, id: row.id, status, tracking_number: tracking });
  } catch (error) {
    if (error instanceof ReconnectRequired) return json({ error: 'Reconnect Cycle Courier Co in Settings, then try again.' }, 409);
    console.error('cycle-courier-link-order:', (error as Error).message);
    return json({ error: (error as Error).message }, 500);
  }
});
