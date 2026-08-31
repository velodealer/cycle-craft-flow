// Books an OUTBOUND delivery with Cycle Courier Co: the shop (BPS) is the
// sender, the buying customer is the receiver.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Missing Authorization header' }, 401);
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: 'Invalid or expired session' }, 401);

    const body = await req.json().catch(() => ({}));
    const bikeId = typeof body.bike_id === 'string' ? body.bike_id.trim() : '';
    if (!UUID_RE.test(bikeId)) return json({ error: 'A valid bike_id is required' }, 400);

    const receiver = {
      name: String(body.receiver_name ?? '').trim(),
      email: String(body.receiver_email ?? '').trim(),
      phone: String(body.receiver_phone ?? '').trim(),
      street: String(body.receiver_street ?? '').trim(),
      city: String(body.receiver_city ?? '').trim(),
      postcode: String(body.receiver_postcode ?? '').trim(),
      country: String(body.receiver_country ?? 'UK').trim() || 'UK',
    };
    const instructions = String(body.delivery_instructions ?? '').trim();

    if (!receiver.name || !receiver.street || !receiver.city || !receiver.postcode) {
      return json({ error: 'Delivery name, street, city and postcode are required' }, 400);
    }

    const { data: bike, error: bikeError } = await supabase
      .from('bikes')
      .select('id, make, model, frame_number, year, sale_price, asking_price')
      .eq('id', bikeId)
      .maybeSingle();
    if (bikeError) throw new Error(bikeError.message);
    if (!bike) return json({ error: 'Bike not found' }, 404);

    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('name', 'cycle_courier_co')
      .eq('is_active', true)
      .maybeSingle();

    // Record the delivery locally regardless — the courier call may fail.
    const shop: any = (integration?.settings as any)?.bps_receiver ?? {};
    const shopAddress = shop.address ?? {};
    const senderName = shop.name || 'Brighton Premium Storage';
    const senderEmail = shop.email || 'info@bps.com';
    const senderPhone = shop.phone || '+44 1234 567890';
    const senderStreet = shopAddress.street || '';
    const senderCity = shopAddress.city || '';
    const senderPostcode = shopAddress.postcode || shopAddress.zipcode || shopAddress.zipCode || '';
    const senderCountry = shopAddress.country || 'UK';

    const { data: delivery, error: createError } = await supabase
      .from('bike_collections')
      .insert({
        bike_id: bikeId,
        direction: 'outbound',
        status: 'pending',
        sender_name: senderName,
        sender_email: senderEmail,
        sender_phone: senderPhone,
        address_street: senderStreet,
        address_city: senderCity,
        address_postcode: senderPostcode,
        address_country: senderCountry,
        receiver_name: receiver.name,
        receiver_email: receiver.email || null,
        receiver_phone: receiver.phone || null,
        receiver_street: receiver.street,
        receiver_city: receiver.city,
        receiver_postcode: receiver.postcode,
        receiver_country: receiver.country,
        delivery_instructions: instructions || null,
      })
      .select()
      .single();
    if (createError) throw new Error(createError.message);

    if (!integration?.api_key) {
      await supabase
        .from('bike_collections')
        .update({ status: 'failed', error_message: 'Cycle Courier integration is not configured' })
        .eq('id', delivery.id);
      return json({ error: 'Cycle Courier integration is not configured', delivery_id: delivery.id }, 400);
    }

    const orderPayload = {
      customerOrderNumber: bikeId,
      sender: {
        name: senderName,
        email: senderEmail,
        phone: senderPhone,
        address: { street: senderStreet, city: senderCity, zipCode: senderPostcode, country: senderCountry },
      },
      receiver: {
        name: receiver.name,
        email: receiver.email,
        phone: receiver.phone,
        address: { street: receiver.street, city: receiver.city, zipCode: receiver.postcode, country: receiver.country },
      },
      bikes: [
        {
          brand: bike.make,
          model: bike.model,
          frameNumber: bike.frame_number || 'N/A',
          year: bike.year || new Date().getFullYear(),
          value: bike.sale_price || bike.asking_price || 1000,
        },
      ],
      deliveryInstructions: instructions,
      requiresSignature: true,
    };

    const response = await fetch('https://api.cyclecourierco.com/functions/v1/orders', {
      method: 'POST',
      headers: { 'X-API-Key': integration.api_key, 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Cycle Courier delivery request failed [${response.status}]: ${errorText}`);
      await supabase
        .from('bike_collections')
        .update({
          status: 'failed',
          error_message: `API error: ${response.status} - ${errorText}`,
          retry_count: (delivery.retry_count ?? 0) + 1,
        })
        .eq('id', delivery.id);
      return json({ error: 'Failed to book the delivery', status: response.status, details: errorText }, response.status);
    }

    const responseData = await response.json();
    await supabase
      .from('bike_collections')
      .update({
        order_id: responseData.id,
        tracking_number: responseData.trackingNumber,
        status: responseData.status || 'scheduled',
        error_message: null,
      })
      .eq('id', delivery.id);

    return json({ ok: true, delivery_id: delivery.id, order_id: responseData.id, tracking_number: responseData.trackingNumber });
  } catch (e) {
    const message = (e as Error).message;
    console.error('create-delivery-order error', message);
    return json({ error: message }, 500);
  }
});
