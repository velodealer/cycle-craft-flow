import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

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

    // 1. Get Cycle Courier integration
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('name', 'cycle_courier_co')
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      console.error('Integration not found or inactive:', integrationError);
      return new Response(
        JSON.stringify({ success: false, error: 'Cycle Courier integration not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!integration.api_key) {
      return new Response(
        JSON.stringify({ success: false, error: 'API key not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
        status: 'pending'
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

    // 3. Get BPS receiver address from settings
    const bpsReceiver = integration.settings?.bps_receiver || {
      name: 'Brighton Premium Storage',
      email: 'info@bps.com',
      phone: '+44 1234 567890',
      address: {
        street: '123 BPS Street',
        city: 'Brighton',
        postcode: 'BN1 1AA',
        country: 'UK'
      }
    };

    // 4. Prepare order payload for Cycle Courier API
    const orderPayload = {
      customerOrderNumber: bike_id,
      sender: {
        name: sender_name,
        email: sender_email,
        phone: sender_phone,
        address: {
          street: address_street,
          city: address_city,
          postcode: address_postcode,
          country: 'UK'
        }
      },
      receiver: {
        name: bpsReceiver.name,
        email: bpsReceiver.email,
        phone: bpsReceiver.phone,
        address: bpsReceiver.address
      },
      deliveryInstructions: delivery_instructions || '',
      itemDescription: 'Bicycle',
      itemValue: 1000,
      requiresSignature: true
    };

    console.log('Calling Cycle Courier API...');

    // 5. Call Cycle Courier API
    const response = await fetch('https://booking.cyclecourierco.com/api/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integration.api_key}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `bike_${bike_id}_${Date.now()}`
      },
      body: JSON.stringify(orderPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cycle Courier API error:', response.status, errorText);
      
      // Update collection with error
      await supabase
        .from('bike_collections')
        .update({
          status: 'failed',
          error_message: `API error: ${response.status} - ${errorText}`,
          retry_count: collection.retry_count + 1
        })
        .eq('id', collection.id);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to create collection order',
          details: errorText 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const responseData = await response.json();
    console.log('Collection order created:', responseData);

    // 6. Update collection record with API response
    const { error: updateError } = await supabase
      .from('bike_collections')
      .update({
        order_id: responseData.id,
        tracking_number: responseData.trackingNumber,
        status: responseData.status || 'scheduled'
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

    return new Response(
      JSON.stringify({ 
        success: true, 
        collection_id: collection.id,
        order_id: responseData.id,
        tracking_number: responseData.trackingNumber,
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
