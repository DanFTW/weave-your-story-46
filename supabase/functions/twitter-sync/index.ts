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

interface Tweet {
  id: string;
  text: string;
  authorUsername?: string;
  createdAt: string;
  retweetCount?: number;
  likeCount?: number;
  replyCount?: number;
  isRetweet?: boolean;
  isReply?: boolean;
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

    // Get user's Twitter integration
    const { data: integration, error: intError } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('integration_id', 'twitter')
      .eq('status', 'connected')
      .maybeSingle();

    if (intError || !integration) {
      return new Response(JSON.stringify({ error: 'Twitter not connected' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, limit = 20 } = await req.json();

    switch (action) {
      case 'list-tweets': {
        const tweets = await fetchTwitterTimeline(integration.composio_connection_id, limit);
        return new Response(JSON.stringify({ tweets }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'sync': {
        const result = await syncTwitterContent(supabase, user.id, integration.composio_connection_id);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'reset-sync': {
        // Delete all synced tweets and reset config
        await supabase
          .from('twitter_synced_posts')
          .delete()
          .eq('user_id', user.id);

        await supabase
          .from('twitter_sync_config')
          .update({
            last_sync_at: null,
            last_synced_tweet_id: null,
            tweets_synced_count: 0,
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
    console.error('Twitter sync error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Step 1: Get authenticated user's username using TWITTER_USER_LOOKUP_ME
async function getTwitterUserInfo(connectionId: string): Promise<{ username: string; userId: string } | null> {
  try {
    console.log('Fetching Twitter user info with TWITTER_USER_LOOKUP_ME...');
    
    const response = await fetch('https://backend.composio.dev/api/v3/tools/execute/TWITTER_USER_LOOKUP_ME', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': COMPOSIO_API_KEY!,
      },
      body: JSON.stringify({
        connected_account_id: connectionId,
        arguments: {},
      }),
    });

    const responseText = await response.text();
    console.log('User lookup response status:', response.status);
    console.log('User lookup response:', responseText.slice(0, 1000));

    if (!response.ok) {
      console.error('Failed to get user info:', responseText);
      return null;
    }

    const data = JSON.parse(responseText);
    console.log('Parsed user lookup data keys:', Object.keys(data || {}));
    
    // Extract username from response - handle various structures
    const responseData = data?.data || data;
    console.log('responseData keys:', Object.keys(responseData || {}));
    
    if (responseData?.response_data) {
      console.log('response_data keys:', Object.keys(responseData.response_data || {}));
      console.log('response_data.data:', JSON.stringify(responseData.response_data?.data)?.slice(0, 500));
    }
    
    const username = responseData?.response_data?.data?.username || 
                     responseData?.response_data?.username ||
                     responseData?.data?.username ||
                     responseData?.username;
    const userId = responseData?.response_data?.data?.id ||
                   responseData?.response_data?.id ||
                   responseData?.data?.id ||
                   responseData?.id;
    
    console.log('Found Twitter username:', username, 'userId:', userId);
    
    if (username && userId) {
      return { username, userId };
    }
    
    console.error('Could not extract username/userId from response');
    return null;
  } catch (error) {
    console.error('Error getting Twitter user info:', error);
    return null;
  }
}

// Step 2: Fetch tweets using TWITTER_RECENT_SEARCH with from:username query
async function fetchTwitterTimeline(connectionId: string, limit: number): Promise<Tweet[]> {
  try {
    console.log('Fetching Twitter timeline with connection ID:', connectionId);
    
    // First get the authenticated user's username
    const userInfo = await getTwitterUserInfo(connectionId);
    if (!userInfo) {
      console.error('Could not get Twitter username - cannot fetch timeline');
      return [];
    }
    
    console.log('Fetching tweets for user:', userInfo.username);
    
    // Use TWITTER_RECENT_SEARCH with from:username query (searches last 7 days)
    const response = await fetch('https://backend.composio.dev/api/v3/tools/execute/TWITTER_RECENT_SEARCH', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': COMPOSIO_API_KEY!,
      },
      body: JSON.stringify({
        connected_account_id: connectionId,
        arguments: {
          query: `from:${userInfo.username}`,
          max_results: Math.min(limit, 100),
          'tweet.fields': 'created_at,public_metrics,referenced_tweets,in_reply_to_user_id,author_id',
        },
      }),
    });

    const responseText = await response.text();
    console.log('Recent search response status:', response.status);
    console.log('Recent search response (first 2000 chars):', responseText.slice(0, 2000));

    if (!response.ok) {
      console.error('Failed to search tweets:', responseText);
      return [];
    }

    const data = JSON.parse(responseText);
    const tweets: Tweet[] = [];

    // Parse Composio v3 response - handle multiple possible structures
    let tweetsData: any[] = [];
    
    console.log('Top-level data keys:', Object.keys(data || {}));
    
    // Try different response paths (v3 API structure varies)
    const responseData = data?.data || data;
    console.log('responseData keys:', Object.keys(responseData || {}));
    
    if (responseData?.response_data) {
      console.log('response_data keys:', Object.keys(responseData.response_data || {}));
      console.log('response_data.data type:', typeof responseData.response_data?.data);
      if (responseData.response_data?.data) {
        console.log('response_data.data sample:', JSON.stringify(responseData.response_data.data)?.slice(0, 500));
      }
    }
    
    const possiblePaths = [
      responseData?.response_data?.data,
      responseData?.response_data,
      responseData?.data?.data,
      responseData?.data,
      responseData?.result?.data,
      responseData?.result,
      responseData,
    ];

    for (const path of possiblePaths) {
      if (Array.isArray(path) && path.length > 0) {
        tweetsData = path;
        console.log('Found tweets array at path, count:', tweetsData.length);
        break;
      }
    }

    // If still not found, try to extract from nested object
    if (tweetsData.length === 0 && typeof responseData === 'object') {
      // Check for nested response_data object
      if (responseData?.response_data && typeof responseData.response_data === 'object') {
        if (responseData.response_data.data && Array.isArray(responseData.response_data.data)) {
          tweetsData = responseData.response_data.data;
          console.log('Found tweets in response_data.data, count:', tweetsData.length);
        }
      }
    }

    console.log('Final parsed tweets count:', tweetsData.length);
    if (tweetsData.length > 0) {
      console.log('First tweet sample:', JSON.stringify(tweetsData[0])?.slice(0, 500));
    }

    for (const tweet of tweetsData) {
      tweets.push({
        id: tweet.id || tweet.tweet_id || String(Date.now()),
        text: tweet.text || tweet.full_text || '',
        authorUsername: userInfo.username,  // We know the username
        createdAt: tweet.created_at || new Date().toISOString(),
        retweetCount: tweet.public_metrics?.retweet_count || tweet.retweet_count,
        likeCount: tweet.public_metrics?.like_count || tweet.favorite_count,
        replyCount: tweet.public_metrics?.reply_count,
        isRetweet: (tweet.text || tweet.full_text || '').startsWith('RT @'),
        isReply: tweet.in_reply_to_user_id != null || tweet.in_reply_to_status_id != null,
      });
    }

    console.log('Returning tweets count:', tweets.length);
    return tweets;
  } catch (error) {
    console.error('Error fetching Twitter timeline:', error);
    return [];
  }
}

async function syncTwitterContent(
  supabase: any,
  userId: string,
  connectionId: string
): Promise<{ success: boolean; tweetsSynced: number; memoriesCreated: number; error?: string }> {
  try {
    console.log('Starting Twitter sync for user:', userId);
    
    // Get sync config
    const { data: config } = await supabase
      .from('twitter_sync_config')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    console.log('Sync config:', config);

    // Fetch tweets
    const tweets = await fetchTwitterTimeline(connectionId, 50);
    console.log('Fetched tweets count:', tweets.length);
    
    if (tweets.length === 0) {
      console.log('No tweets found to sync');
      return { success: true, tweetsSynced: 0, memoriesCreated: 0 };
    }

    // Get user's API keys for LIAM
    const { data: apiKeys } = await supabase
      .from('user_api_keys')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!apiKeys) {
      console.error('API keys not configured for user');
      return { success: false, tweetsSynced: 0, memoriesCreated: 0, error: 'API keys not configured' };
    }

    // Get already synced tweet IDs
    const { data: syncedPosts } = await supabase
      .from('twitter_synced_posts')
      .select('twitter_post_id')
      .eq('user_id', userId);

    const syncedIds = new Set((syncedPosts || []).map((p: { twitter_post_id: string }) => p.twitter_post_id));
    console.log('Already synced tweet IDs count:', syncedIds.size);

    // Filter based on config
    const tweetsToSync = tweets.filter((tweet: Tweet) => {
      if (syncedIds.has(tweet.id)) return false;
      if (!config) return true; // Default to sync all if no config
      
      if (tweet.isRetweet && !config.sync_retweets) return false;
      if (tweet.isReply && !config.sync_replies) return false;
      if (!tweet.isRetweet && !tweet.isReply && !config.sync_tweets) return false;
      
      return true;
    });

    console.log('Tweets to sync after filtering:', tweetsToSync.length);

    let memoriesCreated = 0;

    for (const tweet of tweetsToSync) {
      const memory = formatTweetAsMemory(tweet);
      console.log('Creating memory for tweet:', tweet.id, 'content preview:', memory.slice(0, 100));
      
      const success = await createMemory(apiKeys, memory);
      
      if (success) {
        // Record synced tweet
        await supabase
          .from('twitter_synced_posts')
          .insert({
            user_id: userId,
            twitter_post_id: tweet.id,
          });
        memoriesCreated++;
        console.log('Memory created successfully for tweet:', tweet.id);
      } else {
        console.error('Failed to create memory for tweet:', tweet.id);
      }
    }

    // Update sync config
    await supabase
      .from('twitter_sync_config')
      .upsert({
        user_id: userId,
        last_sync_at: new Date().toISOString(),
        last_synced_tweet_id: tweets[0]?.id,
        tweets_synced_count: (config?.tweets_synced_count || 0) + tweetsToSync.length,
        memories_created_count: (config?.memories_created_count || 0) + memoriesCreated,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    console.log('Sync complete. Tweets synced:', tweetsToSync.length, 'Memories created:', memoriesCreated);

    return {
      success: true,
      tweetsSynced: tweetsToSync.length,
      memoriesCreated,
    };
  } catch (error) {
    console.error('Sync error:', error);
    return { 
      success: false, 
      tweetsSynced: 0, 
      memoriesCreated: 0, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

function formatTweetAsMemory(tweet: Tweet): string {
  const date = new Date(tweet.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let type = 'Tweet';
  if (tweet.isRetweet) type = 'Retweet';
  if (tweet.isReply) type = 'Reply';

  let memory = `Twitter ${type}\nPosted on ${date}`;
  if (tweet.authorUsername) {
    memory += ` by @${tweet.authorUsername}`;
  }
  memory += '\n\n' + tweet.text;

  // Add engagement stats if available
  const stats: string[] = [];
  if (tweet.likeCount) stats.push(`${tweet.likeCount} likes`);
  if (tweet.retweetCount) stats.push(`${tweet.retweetCount} retweets`);
  if (tweet.replyCount) stats.push(`${tweet.replyCount} replies`);
  
  if (stats.length > 0) {
    memory += '\n\n' + stats.join(' • ');
  }

  return memory;
}

// LIAM API integration with cryptographic signing
async function createMemory(apiKeys: { api_key: string; private_key: string; user_key: string }, content: string): Promise<boolean> {
  try {
    const body = JSON.stringify({
      memory: content,
      userKey: apiKeys.user_key,
      tag: 'TWITTER',
    });

    const signature = await signRequest(apiKeys.private_key, body);

    const response = await fetch(LIAM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKeys.api_key,
        'X-Signature': signature,
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LIAM API error:', response.status, errorText);
      return false;
    }

    console.log('LIAM API success for memory creation');
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
