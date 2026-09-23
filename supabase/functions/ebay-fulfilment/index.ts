// Marks an eBay order despatched with carrier and tracking number.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { serviceClient, requireUser, requireRole, businessIdForUser, requireConnection, ebayFetch } from '../_shared/ebay.ts';
import { logBikeActivity } from '../_shared/activity.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const Body = z.object({
  order_row_id: z.string().uuid(),
  carrier: z.string().trim().min(1).max(60),
  tracking_number: z.string().trim().min(3).max(60),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = serviceClient();
  let businessId: string;
  try {
    const user = await requireUser(req, supabase);
    await requireRole(supabase, user.id, ['admin', 'owner', 'customer_service']);
    businessId = await businessIdForUser(supabase, user.id);
  } catch (e) {
    return json({ error: (e as Error).message }, 401);
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: 'Enter a carrier and a tracking number.' }, 400);
  const { order_row_id, carrier, tracking_number } = parsed.data;

  const { data: row, error: rowErr } = await supabase
    .from('ebay_orders').select('*').eq('id', order_row_id).eq('business_id', businessId).maybeSingle();
  if (rowErr) return json({ error: `Could not load the order: ${rowErr.message}` }, 500);
  if (!row) return json({ error: 'Order not found' }, 404);
  const r = row as any;

  try {
    const conn = await requireConnection(supabase, businessId);
    const orderId = String(r.order_id).split(':')[0];
    const lineItems = (r.raw?.lineItems ?? [])
      .filter((li: any) => !r.line_item_id || li.lineItemId === r.line_item_id)
      .map((li: any) => ({ lineItemId: li.lineItemId, quantity: li.quantity ?? 1 }));
    await ebayFetch(conn, `/sell/fulfillment/v1/order/${encodeURIComponent(orderId)}/shipping_fulfillment`, {
      method: 'POST',
      body: JSON.stringify({
        lineItems,
        shippedDate: new Date().toISOString(),
        shippingCarrierCode: carrier.replace(/\s+/g, ''),
        trackingNumber: tracking_number.replace(/\s+/g, ''),
      }),
    });
    const { error: upErr } = await supabase.from('ebay_orders').update({
      status: 'despatched', carrier, tracking_number, despatched_at: new Date().toISOString(),
    }).eq('id', order_row_id);
    // eBay already has the tracking; say so plainly so nobody re-submits it.
    if (upErr) return json({ error: `Marked despatched on eBay, but VeloDealer could not record it: ${upErr.message}. Do not resubmit.` }, 500);
    if (r.bike_id) {
      await logBikeActivity(r.bike_id, {
        kind: 'listing',
        action: 'ebay_despatched',
        summary: `eBay order marked despatched (${carrier} ${tracking_number})`,
        detail: { order_id: r.order_id, carrier, tracking_number },
        actorLabel: 'eBay',
      }, businessId);
    }
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
