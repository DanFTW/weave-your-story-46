import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client and verify user
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log(`Google Photos Auth - User: ${userId}`);

    const body = await req.json();
    const { baseUrl } = body;

    if (!baseUrl) {
      return new Response(
        JSON.stringify({ error: 'baseUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a state token for CSRF protection
    const state = crypto.randomUUID();

    // Store state in user_integrations for verification later
    const { error: insertError } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: userId,
        integration_id: 'googlephotos',
        status: 'pending',
        composio_connection_id: state, // Temporarily store state here
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,integration_id'
      });

    if (insertError) {
      console.error('Failed to store state:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to initiate auth' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the callback URL
    const callbackUrl = `${baseUrl}/oauth-complete?toolkit=googlephotos`;
    
    // Google Photos Picker API requires specific scopes
    const scopes = [
      'https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
    ].join(' ');

    // Build Google OAuth URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', `${SUPABASE_URL}/functions/v1/google-photos-callback`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('state', `${state}|${encodeURIComponent(callbackUrl)}`);

    console.log('Generated OAuth URL:', authUrl.toString());

    return new Response(
      JSON.stringify({ 
        redirectUrl: authUrl.toString(),
        connectionId: state,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Google Photos Auth error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
