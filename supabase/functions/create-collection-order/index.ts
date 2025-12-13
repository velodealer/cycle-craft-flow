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

    // 1. Get bike details
    const { data: bike, error: bikeError } = await supabase
      .from('bikes')
      .select('id, make, model, frame_number, year, sale_price, asking_price')
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

    // 2. Get Cycle Courier integration
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
        zipCode: 'BN1 1AA',
        country: 'UK'
      }
    };

    // 4. Prepare order payload for Cycle Courier API
    const bikeValue = bike.sale_price || bike.asking_price || 1000;
    const orderPayload = {
      customerOrderNumber: bike_id,
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
      receiver: {
        name: bpsReceiver.name,
        email: bpsReceiver.email,
        phone: bpsReceiver.phone,
        address: {
          street: bpsReceiver.address.street,
          city: bpsReceiver.address.city,
          zipCode: bpsReceiver.address.postcode || bpsReceiver.address.zipcode || bpsReceiver.address.zipCode,
          country: bpsReceiver.address.country
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

    // 5. Call Cycle Courier API
    const response = await fetch('https://api.cyclecourierco.com/functions/v1/orders', {
      method: 'POST',
      headers: {
        'X-API-Key': integration.api_key,
        'Content-Type': 'application/json'
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
