import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  type?: string;
  status_type?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's Facebook integration
    const { data: integration, error: intError } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('integration_id', 'facebook')
      .eq('status', 'connected')
      .maybeSingle();

    if (intError || !integration) {
      return new Response(JSON.stringify({ error: 'Facebook not connected' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action } = await req.json();

    switch (action) {
      case 'sync': {
        const result = await syncFacebookContent(supabase, user.id, integration.composio_connection_id);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'reset-sync': {
        await supabase
          .from('facebook_synced_posts')
          .delete()
          .eq('user_id', user.id);

        await supabase
          .from('facebook_sync_config')
          .update({
            last_sync_at: null,
            last_synced_post_id: null,
            posts_synced_count: 0,
            memories_created_count: 0,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('Facebook sync error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function getAccessToken(connectionId: string): Promise<string | null> {
  try {
    console.log('Fetching access token from Composio for connection:', connectionId);
    const response = await fetch(`https://backend.composio.dev/api/v3/connected_accounts/${connectionId}`, {
      headers: { 'x-api-key': COMPOSIO_API_KEY! },
    });

    if (!response.ok) {
      console.error('Failed to fetch connected account:', response.status, await response.text());
      return null;
    }

    const responseData = await response.json();
    const data = responseData.data || responseData;
    console.log('Response keys:', Object.keys(data).join(', '));
    const token =
      data.access_token ||
      data.params?.access_token ||
      data.connectionParams?.access_token ||
      data.connection_params?.access_token;
    console.log('Access token retrieved:', token ? 'yes' : 'no');
    return token || null;
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
}

async function fetchFacebookPosts(connectionId: string): Promise<{ posts: FacebookPost[]; error?: string }> {
  try {
    const accessToken = await getAccessToken(connectionId);
    if (!accessToken) {
      console.error('No access token available for Facebook');
      return { posts: [], error: 'No access token available' };
    }

    // Step 1: Get managed pages
    console.log('Fetching managed Facebook Pages via /me/accounts...');
    const accountsResp = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token&access_token=${accessToken}`
    );
    const accountsData = await accountsResp.json();
    console.log('/me/accounts status:', accountsResp.status, 'pages:', (accountsData?.data || []).length);

    if (!accountsResp.ok) {
      console.error('/me/accounts error:', JSON.stringify(accountsData).slice(0, 500));
      return { posts: [], error: 'Failed to fetch Facebook Pages' };
    }

    const pages = accountsData?.data || [];
    if (pages.length === 0) {
      return { posts: [], error: 'No Facebook Pages found. Please make sure you have a Facebook Page connected.' };
    }

    const page = pages[0];
    const pageId = page.id;
    const pageToken = page.access_token;
    console.log('Using Facebook Page:', page.name, '(id:', pageId + ')');

    // Step 2: Fetch page posts
    const allPosts: FacebookPost[] = [];
    let url: string | null = `https://graph.facebook.com/v19.0/${pageId}/posts?fields=id,message,created_time,permalink_url&limit=100&access_token=${pageToken}`;
    let pageNum = 0;

    while (url) {
      pageNum++;
      console.log(`Fetching page posts page ${pageNum}...`);
      const response = await fetch(url);
      const responseText = await response.text();
      console.log('Graph API response status:', response.status, 'length:', responseText.length);

      if (!response.ok) {
        console.error('Graph API error:', responseText.slice(0, 1000));
        break;
      }

      const data = JSON.parse(responseText);
      const posts = data?.data || [];
      console.log(`Page ${pageNum}: got ${posts.length} posts`);

      for (const post of posts) {
        allPosts.push({
          id: post.id,
          message: post.message || '',
          created_time: post.created_time || new Date().toISOString(),
          permalink_url: post.permalink_url,
        });
      }

      url = data?.paging?.next || null;
    }

    console.log('Total Facebook Page posts fetched:', allPosts.length);
    return { posts: allPosts };
  } catch (error) {
    console.error('Error fetching Facebook posts:', error);
    return { posts: [], error: error instanceof Error ? error.message : 'Unknown fetch error' };
  }
}

async function syncFacebookContent(
  supabase: any,
  userId: string,
  connectionId: string
): Promise<{ success: boolean; postsSynced: number; memoriesCreated: number; error?: string }> {
  try {
    console.log('Starting Facebook sync for user:', userId);
    
    // Get or create sync config
    const { data: config } = await supabase
      .from('facebook_sync_config')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    // Fetch posts with preflight validation
    const { posts, error: fetchError } = await fetchFacebookPosts(connectionId);
    
    if (fetchError) {
      console.error('Facebook fetch failed:', fetchError);
      return { success: false, postsSynced: 0, memoriesCreated: 0, error: fetchError };
    }

    console.log('Fetched Facebook posts count:', posts.length);
    
    if (posts.length === 0) {
      // Still update config to record the sync attempt
      await supabase
        .from('facebook_sync_config')
        .upsert({
          user_id: userId,
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      return { success: true, postsSynced: 0, memoriesCreated: 0 };
    }

    // Get user's API keys for LIAM
    const { data: apiKeys } = await supabase
      .from('user_api_keys')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!apiKeys) {
      console.error('API keys not configured for user');
      return { success: false, postsSynced: 0, memoriesCreated: 0, error: 'API keys not configured' };
    }

    // Get already synced post IDs
    const { data: syncedPosts } = await supabase
      .from('facebook_synced_posts')
      .select('facebook_post_id')
      .eq('user_id', userId);

    const syncedIds = new Set((syncedPosts || []).map((p: { facebook_post_id: string }) => p.facebook_post_id));
    console.log('Already synced post IDs count:', syncedIds.size);

    // Filter to unseen posts
    const postsToSync = posts.filter((post: FacebookPost) => {
      if (syncedIds.has(post.id)) return false;
      return true;
    });

    console.log('Posts to sync after filtering:', postsToSync.length);

    let memoriesCreated = 0;

    for (const post of postsToSync) {
      if (!post.message) {
        console.log('Skipping post with no message:', post.id);
        continue;
      }
      const memory = formatPostAsMemory(post);
      console.log('Creating memory for post:', post.id, 'content preview:', memory.slice(0, 100));
      
      const success = await createMemory(apiKeys, memory);
      
      if (success) {
        await supabase
          .from('facebook_synced_posts')
          .insert({
            user_id: userId,
            facebook_post_id: post.id,
          });
        memoriesCreated++;
        console.log('Memory created successfully for post:', post.id);
      } else {
        console.error('Failed to create memory for post:', post.id);
      }
    }

    // Update sync config
    await supabase
      .from('facebook_sync_config')
      .upsert({
        user_id: userId,
        last_sync_at: new Date().toISOString(),
        last_synced_post_id: posts[0]?.id,
        posts_synced_count: (config?.posts_synced_count || 0) + postsToSync.length,
        memories_created_count: (config?.memories_created_count || 0) + memoriesCreated,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    console.log('Sync complete. Posts synced:', postsToSync.length, 'Memories created:', memoriesCreated);

    return {
      success: true,
      postsSynced: postsToSync.length,
      memoriesCreated,
    };
  } catch (error) {
    console.error('Sync error:', error);
    return { 
      success: false, 
      postsSynced: 0, 
      memoriesCreated: 0, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

function formatPostAsMemory(post: FacebookPost): string {
  const date = new Date(post.created_time).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let memory = `Facebook Post\nPosted on ${date}`;
  
  if (post.message) {
    memory += '\n\n' + post.message;
  } else {
    memory += '\n\n[No text content]';
  }

  const meta: string[] = [`Source: Facebook`, `Post ID: ${post.id}`];
  if (post.permalink_url) meta.push(`URL: ${post.permalink_url}`);
  if (post.type) meta.push(`Type: ${post.type}`);
  
  memory += '\n\n' + meta.join(' | ');

  return memory;
}

// LIAM API integration with cryptographic signing
async function createMemory(apiKeys: { api_key: string; private_key: string; user_key: string }, memoryContent: string): Promise<boolean> {
  try {
    const requestBody = {
      content: memoryContent,
      userKey: apiKeys.user_key,
      tag: 'FACEBOOK',
    };
    
    const bodyString = JSON.stringify(requestBody);
    const signature = await signRequest(apiKeys.private_key, bodyString);

    const response = await fetch(LIAM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apiKey': apiKeys.api_key,
        'signature': signature,
      },
      body: bodyString,
    });

    const responseText = await response.text();
    console.log('LIAM API response:', response.status, responseText.slice(0, 500));

    if (!response.ok) {
      console.error('LIAM API error:', response.status, responseText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Create memory error:', error);
    return false;
  }
}

// Crypto utilities for LIAM API signing
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
  const cleanKey = base64Key
    .replace(/-----BEGIN.*-----/g, '')
    .replace(/-----END.*-----/g, '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(cleanKey), c => c.charCodeAt(0));
  
  return await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

async function signRequest(privateKeyBase64: string, body: string): Promise<string> {
  const key = await importPrivateKey(privateKeyBase64);
  const encoder = new TextEncoder();
  const data = encoder.encode(body);
  
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    data
  );
  
  const derSignature = toDER(new Uint8Array(signature));
  return btoa(String.fromCharCode(...derSignature));
}
