import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get HMAC signature from headers
    const signature = req.headers.get('x-webhook-signature');
    
    if (!signature) {
      console.error('Webhook authentication failed: No signature provided');
      return new Response(
        JSON.stringify({ error: 'Webhook signature is required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get the raw body text (must be raw for signature verification)
    const rawBody = await req.text();

    // Validate webhook secret against stored integration
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('webhook_secret, is_active')
      .eq('name', 'cycle_courier_co')
      .single();

    if (integrationError || !integration) {
      console.error('Integration not found:', integrationError);
      return new Response(
        JSON.stringify({ error: 'Integration not configured' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!integration.is_active) {
      console.error('Integration is not active');
      return new Response(
        JSON.stringify({ error: 'Integration is not active' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!integration.webhook_secret) {
      console.error('Webhook secret not configured');
      return new Response(
        JSON.stringify({ error: 'Webhook secret not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Compute HMAC SHA-256 signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(integration.webhook_secret);
    const messageData = encoder.encode(rawBody);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Handle both signature formats: with or without 'sha256=' prefix
    const receivedHash = signature.startsWith('sha256=') 
      ? signature.substring(7) 
      : signature;

    // Compare just the hash values
    if (receivedHash !== hashHex) {
      console.error('Webhook authentication failed: Invalid signature');
      console.error('Received hash:', receivedHash);
      console.error('Expected hash:', hashHex);
      return new Response(
        JSON.stringify({ error: 'Invalid webhook signature' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Webhook signature validated successfully');

    // Parse webhook payload (after signature verification)
    const payload = JSON.parse(rawBody);
    console.log('Received webhook payload:', JSON.stringify(payload));

    // Extract order data from payload
    const order = payload.data?.order;
    const orderId = order?.id;

    if (!orderId) {
      console.error('No order ID in webhook payload');
      return new Response(
        JSON.stringify({ error: 'No order ID provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the collection record by order_id
    const { data: collection, error: collectionError } = await supabase
      .from('bike_collections')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (collectionError || !collection) {
      console.error('Collection not found for order:', orderId, collectionError);
      return new Response(
        JSON.stringify({ error: 'Collection not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing event for collection:', collection.id);

    // Process the payload based on event type
    switch (payload.event_type) {
      case 'order.created':
      case 'delivery.created':
        console.log('New delivery created:', payload.data);
        await supabase
          .from('bike_collections')
          .update({ 
            status: order.status || 'scheduled',
            scheduled_date: order.scheduledDate || null
          })
          .eq('id', collection.id);
        break;
        
      case 'order.status.updated':
      case 'delivery.status_updated':
        console.log('Delivery status updated:', order.status);
        
        // Update collection status
        await supabase
          .from('bike_collections')
          .update({ 
            status: order.status,
            scheduled_date: order.scheduledDate || null
          })
          .eq('id', collection.id);
        
        // Map Cycle Courier status to bike status
        let bikeStatus = null;
        switch (order.status) {
          case 'scheduled':
            bikeStatus = 'awaiting_collection';
            break;
          case 'driver_to_collection':
            bikeStatus = 'collection_in_progress';
            break;
          case 'collected':
            bikeStatus = 'in_transit';
            break;
          case 'driver_to_delivery':
            bikeStatus = 'in_transit';
            break;
          case 'delivered':
            bikeStatus = 'pending_intake';
            await supabase
              .from('bike_collections')
              .update({ completed_at: new Date().toISOString() })
              .eq('id', collection.id);
            break;
        }
        
        if (bikeStatus) {
          await supabase
            .from('bikes')
            .update({ status: bikeStatus })
            .eq('id', collection.bike_id);
        }
        break;
        
      case 'delivery.completed':
      case 'order.delivery.completed':
        console.log('Delivery completed:', payload.data);
        
        await supabase
          .from('bike_collections')
          .update({ 
            status: 'delivered',
            completed_at: new Date().toISOString()
          })
          .eq('id', collection.id);
        
        await supabase
          .from('bikes')
          .update({ status: 'pending_intake' })
          .eq('id', collection.bike_id);
        break;
        
      case 'delivery.failed':
      case 'order.cancelled':
        console.log('Delivery failed or cancelled:', payload.data);
        
        await supabase
          .from('bike_collections')
          .update({ 
            status: 'cancelled',
            error_message: order.cancellationReason || 'Order was cancelled'
          })
          .eq('id', collection.id);
        break;
        
      default:
        console.log('Unhandled event type:', payload.event_type);
    }

    // Log webhook event (optional - create webhook_logs table if needed)
    // await supabase.from('webhook_logs').insert({
    //   integration_name: 'cycle_courier_co',
    //   event_type,
    //   payload,
    //   status: 'success',
    //   received_at: new Date().toISOString()
    // });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook processed successfully',
        event_type 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error processing webhook:', error);
    
    // Log failed webhook attempt
    // await supabase.from('webhook_logs').insert({
    //   integration_name: 'cycle_courier_co',
    //   payload: await req.text(),
    //   status: 'error',
    //   error_message: error.message,
    //   received_at: new Date().toISOString()
    // });

    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
