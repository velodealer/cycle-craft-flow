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
    const expectedSignature = `sha256=${hashHex}`;

    // Compare signatures
    if (signature !== expectedSignature) {
      console.error('Webhook authentication failed: Invalid signature');
      console.error('Received:', signature);
      console.error('Expected:', expectedSignature);
      return new Response(
        JSON.stringify({ error: 'Invalid webhook signature' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse webhook payload (after signature verification)
    const payload = JSON.parse(rawBody);
    console.log('Received webhook payload:', JSON.stringify(payload));

    // Process webhook based on event type
    // This is a placeholder - customize based on actual Cycle Courier Co webhook structure
    const { 
      event_type, 
      delivery_id, 
      bike_id, 
      status, 
      tracking_number,
      timestamp 
    } = payload;

    if (!event_type) {
      return new Response(
        JSON.stringify({ error: 'Invalid payload: event_type is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Handle different event types
    switch (event_type) {
      case 'delivery.created':
        console.log(`Delivery created: ${delivery_id} for bike: ${bike_id}`);
        // TODO: Update bike record with delivery information
        break;

      case 'delivery.status_updated':
        console.log(`Delivery status updated: ${delivery_id} - ${status}`);
        // TODO: Update delivery status in database
        break;

      case 'delivery.completed':
        console.log(`Delivery completed: ${delivery_id}`);
        // TODO: Mark delivery as completed
        break;

      case 'delivery.failed':
        console.log(`Delivery failed: ${delivery_id}`);
        // TODO: Handle failed delivery
        break;

      default:
        console.log(`Unknown event type: ${event_type}`);
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
