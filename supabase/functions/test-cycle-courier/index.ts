import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { apiKey } = await req.json();

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'API key is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate API key format (basic validation)
    if (apiKey.length < 10) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid API key format' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Test connection to Cycle Courier Co API
    // Note: Replace this with actual API endpoint when documentation is available
    const testResponse = await fetch('https://booking.cyclecourierco.com/api/v1/account', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (testResponse.ok) {
      console.log('Cycle Courier Co API connection successful');
      return new Response(
        JSON.stringify({ success: true, message: 'Connection successful' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else {
      const errorText = await testResponse.text();
      console.error('Cycle Courier Co API connection failed:', testResponse.status, errorText);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid API key or connection failed',
          details: errorText 
        }),
        { 
          status: testResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
  } catch (error) {
    console.error('Error testing Cycle Courier Co connection:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
