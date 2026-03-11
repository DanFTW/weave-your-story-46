import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-cron-trigger',
};

const COMPOSIO_API_KEY = Deno.env.get('COMPOSIO_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const LIAM_API_URL = 'https://web.askbuddy.ai/devspacexdb/api/memory/create';

interface FacebookPost {
  id: string;
  message?: string;
  created_time: string;
  permalink_url?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Check for cron invocation
    const cronSecret = req.headers.get('x-cron-secret');
    const isCron = req.headers.get('x-cron-trigger') === 'supabase-internal';
    
    if (isCron && cronSecret) {
      const { data: setting } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'cron_secret')
        .maybeSingle();

      if (!setting || setting.value !== cronSecret) {
        return new Response(JSON.stringify({ error: 'Invalid cron secret' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Poll all active configs
      const { data: activeConfigs } = await supabase
        .from('facebook_page_posts_config')
        .select('user_id')
        .eq('is_active', true);

      if (!activeConfigs || activeConfigs.length === 0) {
        return new Response(JSON.stringify({ message: 'No active configs' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const results = [];
      for (const cfg of activeConfigs) {
        const { data: integration } = await supabase
          .from('user_integrations')
          .select('composio_connection_id')
          .eq('user_id', cfg.user_id)
          .eq('integration_id', 'facebook')
          .eq('status', 'connected')
          .maybeSingle();

        if (integration?.composio_connection_id) {
          const result = await pollPagePosts(supabase, cfg.user_id, integration.composio_connection_id);
          results.push({ userId: cfg.user_id, ...result });
        }
      }

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // User-initiated request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: integration } = await supabase
      .from('user_integrations')
      .select('composio_connection_id')
      .eq('user_id', user.id)
      .eq('integration_id', 'facebook')
      .eq('status', 'connected')
      .maybeSingle();

    if (!integration?.composio_connection_id) {
      return new Response(JSON.stringify({ error: 'Facebook not connected' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action } = await req.json();

    switch (action) {
      case 'activate': {
        await supabase
          .from('facebook_page_posts_config')
          .upsert({ user_id: user.id, is_active: true }, { onConflict: 'user_id' });

        const result = await pollPagePosts(supabase, user.id, integration.composio_connection_id);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'deactivate': {
        await supabase
          .from('facebook_page_posts_config')
          .update({ is_active: false })
          .eq('user_id', user.id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'poll': {
        const result = await pollPagePosts(supabase, user.id, integration.composio_connection_id);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('Facebook page posts error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal server error',
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function getAccessToken(connectionId: string): Promise<string | null> {
  try {
    const response = await fetch(`https://backend.composio.dev/api/v3/connected_accounts/${connectionId}`, {
      headers: { 'x-api-key': COMPOSIO_API_KEY! },
    });
    if (!response.ok) return null;
    const responseData = await response.json();
    const data = responseData.data || responseData;
    return data.access_token || data.params?.access_token || data.connectionParams?.access_token || data.connection_params?.access_token || null;
  } catch { return null; }
}

async function fetchPagePosts(connectionId: string): Promise<{ posts: FacebookPost[]; error?: string }> {
  try {
    const accessToken = await getAccessToken(connectionId);
    if (!accessToken) return { posts: [], error: 'No access token available' };

    // Step 1: Get managed pages
    const accountsResp = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token&access_token=${accessToken}`
    );
    const accountsData = await accountsResp.json();

    if (!accountsResp.ok) {
      console.error('/me/accounts error:', JSON.stringify(accountsData).slice(0, 500));
      return { posts: [], error: 'Failed to fetch Facebook Pages' };
    }

    const pages = accountsData?.data || [];
    if (pages.length === 0) {
      return { posts: [], error: 'No Facebook Pages found. Please make sure you have a Facebook Page connected.' };
    }

    const page = pages[0];
    console.log('Using Facebook Page:', page.name, '(id:', page.id + ')');

    // Step 2: Fetch page posts
    const allPosts: FacebookPost[] = [];
    let url: string | null = `https://graph.facebook.com/v19.0/${page.id}/posts?fields=id,message,created_time,permalink_url&limit=100&access_token=${page.access_token}`;

    while (url) {
      const response = await fetch(url);
      if (!response.ok) break;
      const data = await response.json();
      for (const post of (data?.data || [])) {
        allPosts.push({
          id: post.id,
          message: post.message || '',
          created_time: post.created_time || new Date().toISOString(),
          permalink_url: post.permalink_url,
        });
      }
      url = data?.paging?.next || null;
    }

    return { posts: allPosts };
  } catch (error) {
    console.error('Error fetching page posts:', error);
    return { posts: [], error: error instanceof Error ? error.message : 'Unknown fetch error' };
  }
}

async function pollPagePosts(
  supabase: any,
  userId: string,
  connectionId: string,
): Promise<{ success: boolean; newPosts: number; totalSynced: number; error?: string }> {
  try {
    const { posts, error: fetchError } = await fetchPagePosts(connectionId);
    if (fetchError) return { success: false, newPosts: 0, totalSynced: 0, error: fetchError };

    // Get already synced
    const { data: syncedPosts } = await supabase
      .from('facebook_synced_posts')
      .select('facebook_post_id')
      .eq('user_id', userId);

    const syncedIds = new Set((syncedPosts || []).map((p: any) => p.facebook_post_id));

    const newPosts = posts.filter(p => !syncedIds.has(p.id));

    if (newPosts.length === 0) {
      await supabase
        .from('facebook_page_posts_config')
        .update({ last_polled_at: new Date().toISOString() })
        .eq('user_id', userId);
      return { success: true, newPosts: 0, totalSynced: syncedIds.size };
    }

    // Get API keys for LIAM
    const { data: apiKeys } = await supabase
      .from('user_api_keys')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!apiKeys) return { success: false, newPosts: 0, totalSynced: syncedIds.size, error: 'API keys not configured' };

    let created = 0;
    for (const post of newPosts) {
      const memory = formatPostAsMemory(post);
      const ok = await createMemory(apiKeys, memory);
      if (ok) {
        await supabase.from('facebook_synced_posts').insert({
          user_id: userId,
          facebook_post_id: post.id,
        });
        created++;
      }
    }

    const totalSynced = syncedIds.size + created;
    await supabase
      .from('facebook_page_posts_config')
      .update({ posts_synced: totalSynced, last_polled_at: new Date().toISOString() })
      .eq('user_id', userId);

    return { success: true, newPosts: created, totalSynced };
  } catch (error) {
    console.error('Poll error:', error);
    return { success: false, newPosts: 0, totalSynced: 0, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

function formatPostAsMemory(post: FacebookPost): string {
  const date = new Date(post.created_time).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  let memory = `Facebook Page Post\nPosted on ${date}`;
  memory += post.message ? '\n\n' + post.message : '\n\n[No text content]';
  const meta: string[] = ['Source: Facebook Page', `Post ID: ${post.id}`];
  if (post.permalink_url) meta.push(`URL: ${post.permalink_url}`);
  memory += '\n\n' + meta.join(' | ');
  return memory;
}

// LIAM API integration with cryptographic signing
async function createMemory(apiKeys: { api_key: string; private_key: string; user_key: string }, memoryContent: string): Promise<boolean> {
  try {
    const requestBody = { content: memoryContent, userKey: apiKeys.user_key, tag: 'FACEBOOK' };
    const bodyString = JSON.stringify(requestBody);
    const signature = await signRequest(apiKeys.private_key, bodyString);

    const response = await fetch(LIAM_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apiKey': apiKeys.api_key, 'signature': signature },
      body: bodyString,
    });

    if (!response.ok) {
      console.error('LIAM API error:', response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error('Create memory error:', error);
    return false;
  }
}

// Crypto utilities
function removeLeadingZeros(arr: Uint8Array): Uint8Array {
  let i = 0;
  while (i < arr.length - 1 && arr[i] === 0) i++;
  return arr.slice(i);
}

function constructLength(len: number): Uint8Array {
  if (len < 128) return new Uint8Array([len]);
  if (len < 256) return new Uint8Array([0x81, len]);
  return new Uint8Array([0x82, (len >> 8) & 0xff, len & 0xff]);
}

function toDER(signature: Uint8Array): Uint8Array {
  const r = removeLeadingZeros(signature.slice(0, 32));
  const s = removeLeadingZeros(signature.slice(32, 64));
  const rPadded = r[0] >= 0x80 ? new Uint8Array([0, ...r]) : r;
  const sPadded = s[0] >= 0x80 ? new Uint8Array([0, ...s]) : s;
  const rLen = constructLength(rPadded.length);
  const sLen = constructLength(sPadded.length);
  const innerLen = 1 + rLen.length + rPadded.length + 1 + sLen.length + sPadded.length;
  const outerLen = constructLength(innerLen);
  const der = new Uint8Array(1 + outerLen.length + innerLen);
  let offset = 0;
  der[offset++] = 0x30;
  der.set(outerLen, offset); offset += outerLen.length;
  der[offset++] = 0x02;
  der.set(rLen, offset); offset += rLen.length;
  der.set(rPadded, offset); offset += rPadded.length;
  der[offset++] = 0x02;
  der.set(sLen, offset); offset += sLen.length;
  der.set(sPadded, offset);
  return der;
}

async function importPrivateKey(base64Key: string): Promise<CryptoKey> {
  const cleanKey = base64Key.replace(/-----BEGIN.*-----/g, '').replace(/-----END.*-----/g, '').replace(/\s/g, '');
  const binaryKey = Uint8Array.from(atob(cleanKey), c => c.charCodeAt(0));
  return await crypto.subtle.importKey('pkcs8', binaryKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

async function signRequest(privateKeyBase64: string, body: string): Promise<string> {
  const key = await importPrivateKey(privateKeyBase64);
  const data = new TextEncoder().encode(body);
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, data);
  const derSignature = toDER(new Uint8Array(signature));
  return btoa(String.fromCharCode(...derSignature));
}
