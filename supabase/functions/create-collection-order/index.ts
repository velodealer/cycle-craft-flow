import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { notifyLogistics } from '../_shared/email.ts';
import { cycleCourierFetch, extractTrackingNumber, extractParty, friendlyCourierError } from '../_shared/cycle-courier.ts';
import { logBikeActivity } from '../_shared/activity.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      bike_id,
      sender_name,
      sender_email,
      sender_phone,
      address_street,
      address_city,
      address_postcode,
      delivery_instructions
    } = await req.json();

    console.log('Creating collection order for bike:', bike_id);

    // 1. Get bike details
    const { data: bike, error: bikeError } = await supabase
      .from('bikes')
      .select('id, reference, make, model, frame_number, year, sale_price, asking_price, business_id')
      .eq('id', bike_id)
      .single();

    if (bikeError || !bike) {
      console.error('Bike not found:', bikeError);
      return new Response(
        JSON.stringify({ success: false, error: 'Bike not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Bike details:', { make: bike.make, model: bike.model, year: bike.year });

    // 2. Create initial collection record
    const { data: collection, error: createError } = await supabase
      .from('bike_collections')
      .insert({
        bike_id,
        sender_name,
        sender_email,
        sender_phone,
        address_street,
        address_city,
        address_postcode,
        delivery_instructions,
        status: 'pending',
        business_id: (bike as any)?.business_id ?? null
      })
      .select()
      .single();

    if (createError) {
      console.error('Failed to create collection record:', createError);
      return new Response(
        JSON.stringify({ success: false, error: createError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Collection record created:', collection.id);

    // 3. Prepare order payload. The delivery side is the dealer themselves —
    // `customer_side` tells Cycle Courier to fill it in from the address saved
    // on the connected account, so we never send a shop address.
    const bikeValue = bike.sale_price || bike.asking_price || 1000;
    const orderPayload = {
      customerOrderNumber: bike.reference || bike.id,
      customer_side: 'receiver',
      sender: {
        name: sender_name,
        email: sender_email,
        phone: sender_phone,
        address: {
          street: address_street,
          city: address_city,
          zipCode: address_postcode,
          country: 'UK'
        }
      },
      bikes: [
        {
          brand: bike.make,
          model: bike.model,
          frameNumber: bike.frame_number || 'N/A',
          year: bike.year || new Date().getFullYear(),
          value: bikeValue
        }
      ],
      deliveryInstructions: delivery_instructions || '',
      requiresSignature: true
    };


    console.log('Sending bike data to API:', JSON.stringify(orderPayload.bikes));

    console.log('Calling Cycle Courier API...');

    // 5. Call Cycle Courier API on behalf of the connected business account
    let response: Response;
    try {
      response = await cycleCourierFetch(
        supabase as any,
        (bike as any).business_id,
        '/orders',
        { method: 'POST', body: JSON.stringify(orderPayload) },
      );
    } catch (e) {
      const message = (e as Error).message;
      await supabase
        .from('bike_collections')
        .update({ status: 'failed', error_message: message })
        .eq('id', collection.id);
      return new Response(
        JSON.stringify({ success: false, error: message, collection_id: collection.id }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cycle Courier API error:', response.status, errorText);

      const message = friendlyCourierError(response.status, errorText);

      // Update collection with error
      await supabase
        .from('bike_collections')
        .update({
          status: 'failed',
          error_message: message,
          retry_count: collection.retry_count + 1
        })
        .eq('id', collection.id);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: message,
          details: errorText 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const responsePayload = await response.json();
    const responseData = responsePayload?.order ?? responsePayload?.data ?? responsePayload;
    const orderId = responseData?.id ?? responseData?.orderId ?? responseData?.order_id;
    const trackingNumber = extractTrackingNumber(responseData);
    console.log('Collection order created:', responseData);

    // 6. Update collection record with API response, including the dealer's own
    // delivery address as Cycle Courier filled it in.
    const shopSide = extractParty(responseData, 'receiver');
    const { error: updateError } = await supabase
      .from('bike_collections')
      .update({
        order_id: orderId,
        tracking_number: trackingNumber,
        status: responseData.status || 'scheduled',
        receiver_name: shopSide.name,
        receiver_email: shopSide.email,
        receiver_phone: shopSide.phone,
        receiver_street: shopSide.street,
        receiver_city: shopSide.city,
        receiver_postcode: shopSide.postcode,
        receiver_country: shopSide.country,
      })
      .eq('id', collection.id);

    if (updateError) {
      console.error('Failed to update collection:', updateError);
    }


    // 7. Update bike status
    const { error: bikeUpdateError } = await supabase
      .from('bikes')
      .update({ status: 'awaiting_collection' })
      .eq('id', bike_id);

    if (bikeUpdateError) {
      console.error('Failed to update bike status:', bikeUpdateError);
    }

    console.log('Collection order created successfully');

    await logBikeActivity(bike_id, {
      kind: 'logistics',
      action: 'booked',
      summary: `Collection booked with Cycle Courier${responseData.status ? ` (${responseData.status})` : ''}`,
      detail: { order_id: responseData.id ?? null, status: responseData.status ?? null },
      actorLabel: 'Cycle Courier',
    });

    await notifyLogistics(supabase as any, bike_id, {
      direction: 'inbound',
      status: `booked (${responseData.status || 'scheduled'})`,
      trackingNumber,
      orderId,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        collection_id: collection.id,
        order_id: orderId,
        tracking_number: trackingNumber,
        status: responseData.status
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating collection order:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
