import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user by passing the token explicitly
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    const body = await req.json();
    const { action } = body;

    console.log(`Google Photos Picker - Action: ${action}, User: ${userId}`);

    // Get user's Google Photos integration with service role
    const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: integration, error: integrationError } = await adminSupabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('integration_id', 'googlephotos')
      .eq('status', 'connected')
      .maybeSingle();

    if (integrationError || !integration) {
      console.error('No Google Photos integration found:', integrationError);
      return new Response(
        JSON.stringify({ error: 'Google Photos not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse stored tokens
    let tokens: {
      access_token: string;
      refresh_token?: string;
      expires_at: string;
    };

    try {
      tokens = JSON.parse(integration.composio_connection_id || '{}');
    } catch (e) {
      console.error('Failed to parse tokens:', e);
      return new Response(
        JSON.stringify({ error: 'Invalid token storage' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token needs refresh
    const expiresAt = new Date(tokens.expires_at);
    const now = new Date();
    const bufferMs = 5 * 60 * 1000; // 5 minute buffer

    if (now.getTime() > expiresAt.getTime() - bufferMs) {
      console.log('Token expired or expiring soon, refreshing...');
      
      if (!tokens.refresh_token) {
        return new Response(
          JSON.stringify({ error: 'Token expired and no refresh token available' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Refresh the token
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: tokens.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      const refreshData = await refreshResponse.json();
      
      if (!refreshResponse.ok || !refreshData.access_token) {
        console.error('Token refresh failed:', refreshData);
        return new Response(
          JSON.stringify({ error: 'Failed to refresh token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update tokens
      tokens.access_token = refreshData.access_token;
      tokens.expires_at = new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString();
      
      // Keep the old refresh token if a new one wasn't provided
      if (refreshData.refresh_token) {
        tokens.refresh_token = refreshData.refresh_token;
      }

      // Save updated tokens
      await adminSupabase
        .from('user_integrations')
        .update({
          composio_connection_id: JSON.stringify(tokens),
          updated_at: new Date().toISOString(),
        })
        .eq('id', integration.id);

      console.log('Token refreshed successfully');
    }

    const accessToken = tokens.access_token;

    // Handle different actions
    switch (action) {
      case 'create-session': {
        // Create a Picker session using the Photos Picker API
        const sessionResponse = await fetch('https://photospicker.googleapis.com/v1/sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });

        const sessionData = await sessionResponse.json();
        console.log('Create session response:', sessionResponse.status, sessionData);

        if (!sessionResponse.ok) {
          console.error('Failed to create picker session:', sessionData);
          return new Response(
            JSON.stringify({ error: 'Failed to create picker session', details: sessionData }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            sessionId: sessionData.id,
            pickerUri: sessionData.pickerUri,
            expireTime: sessionData.expireTime,
            mediaItemsSet: sessionData.mediaItemsSet,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'poll-session': {
        const { sessionId } = body;
        if (!sessionId) {
          return new Response(
            JSON.stringify({ error: 'sessionId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Poll the session to check if user has selected photos
        const pollResponse = await fetch(`https://photospicker.googleapis.com/v1/sessions/${sessionId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        const pollData = await pollResponse.json();
        console.log('Poll session response:', pollResponse.status, pollData);

        if (!pollResponse.ok) {
          return new Response(
            JSON.stringify({ error: 'Failed to poll session', details: pollData }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            sessionId: pollData.id,
            pickerUri: pollData.pickerUri,
            expireTime: pollData.expireTime,
            mediaItemsSet: pollData.mediaItemsSet,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'list-photos': {
        const { sessionId, pageToken } = body;
        if (!sessionId) {
          return new Response(
            JSON.stringify({ error: 'sessionId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // List media items from the picker session
        let url = `https://photospicker.googleapis.com/v1/mediaItems?sessionId=${sessionId}&pageSize=100`;
        if (pageToken) {
          url += `&pageToken=${pageToken}`;
        }

        const listResponse = await fetch(url, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        const listData = await listResponse.json();
        console.log('List photos response:', listResponse.status, 'items:', listData.mediaItems?.length || 0);

        if (!listResponse.ok) {
          return new Response(
            JSON.stringify({ error: 'Failed to list photos', details: listData }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Transform to our format
        const photos = (listData.mediaItems || []).map((item: any) => ({
          id: item.id,
          baseUrl: item.baseUrl,
          mimeType: item.mimeType,
          createdAt: item.createTime,
          type: item.type, // PHOTO or VIDEO
        }));

        return new Response(
          JSON.stringify({
            photos,
            nextPageToken: listData.nextPageToken,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete-session': {
        const { sessionId } = body;
        if (!sessionId) {
          return new Response(
            JSON.stringify({ error: 'sessionId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Delete the picker session
        const deleteResponse = await fetch(`https://photospicker.googleapis.com/v1/sessions/${sessionId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        console.log('Delete session response:', deleteResponse.status);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    console.error('Google Photos Picker error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
