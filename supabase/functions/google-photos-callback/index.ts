import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    console.log('Google Photos Callback received');
    console.log('Code present:', !!code);
    console.log('State:', stateParam);
    console.log('Error:', error);

    if (error) {
      console.error('OAuth error:', error);
      return new Response(
        `<html><body><script>window.location.href='/integration/googlephotos?error=${encodeURIComponent(error)}';</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (!code || !stateParam) {
      console.error('Missing code or state');
      return new Response(
        `<html><body><script>window.location.href='/integration/googlephotos?error=missing_params';</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Parse state: format is "state_token|callback_url"
    const [stateToken, encodedCallbackUrl] = stateParam.split('|');
    const callbackUrl = decodeURIComponent(encodedCallbackUrl || '');
    
    console.log('State token:', stateToken);
    console.log('Callback URL:', callbackUrl);

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find the user by state token
    const { data: integration, error: findError } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('integration_id', 'googlephotos')
      .eq('composio_connection_id', stateToken)
      .eq('status', 'pending')
      .maybeSingle();

    if (findError || !integration) {
      console.error('Failed to find pending integration:', findError);
      return new Response(
        `<html><body><script>window.location.href='/integration/googlephotos?error=invalid_state';</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    console.log('Found integration for user:', integration.user_id);

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${SUPABASE_URL}/functions/v1/google-photos-callback`,
      }),
    });

    const tokenData = await tokenResponse.json();
    console.log('Token exchange response status:', tokenResponse.status);

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('Token exchange failed:', tokenData);
      return new Response(
        `<html><body><script>window.location.href='/integration/googlephotos?error=token_exchange_failed';</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    console.log('Got access token, expires in:', tokenData.expires_in);
    console.log('Got refresh token:', !!tokenData.refresh_token);

    // Get user info from Google
    let accountName = 'Google Photos';
    let accountEmail = '';
    try {
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json();
        accountName = userInfo.name || 'Google Photos';
        accountEmail = userInfo.email || '';
        console.log('Got user info:', accountName, accountEmail);
      }
    } catch (e) {
      console.error('Failed to get user info:', e);
    }

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();

    // Store tokens in a JSON field in composio_connection_id (temporary solution)
    // In production, you'd want a separate secure storage
    const tokenStorage = JSON.stringify({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt,
      token_type: tokenData.token_type,
    });

    // Update integration status
    const { error: updateError } = await supabase
      .from('user_integrations')
      .update({
        status: 'connected',
        composio_connection_id: tokenStorage,
        account_name: accountName,
        account_email: accountEmail,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', integration.id);

    if (updateError) {
      console.error('Failed to update integration:', updateError);
      return new Response(
        `<html><body><script>window.location.href='/integration/googlephotos?error=update_failed';</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    console.log('Integration updated successfully!');

    // Redirect to callback URL
    const finalRedirectUrl = callbackUrl || '/integration/googlephotos';
    console.log('Redirecting to:', finalRedirectUrl);

    return new Response(
      `<html><body><script>window.location.href='${finalRedirectUrl}';</script></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch (error: unknown) {
    console.error('Google Photos Callback error:', error);
    return new Response(
      `<html><body><script>window.location.href='/integration/googlephotos?error=server_error';</script></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
});
