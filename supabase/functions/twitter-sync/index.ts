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

async function fetchTwitterTimeline(connectionId: string, limit: number): Promise<Tweet[]> {
  try {
    const response = await fetch('https://backend.composio.dev/api/v2/actions/TWITTER_USER_TIMELINE_BY_USER_ID/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': COMPOSIO_API_KEY!,
      },
      body: JSON.stringify({
        connectedAccountId: connectionId,
        input: {
          max_results: limit,
        },
      }),
    });

    if (!response.ok) {
      console.error('Failed to fetch timeline:', await response.text());
      return [];
    }

    const data = await response.json();
    const tweets: Tweet[] = [];

    // Parse Composio response
    if (data?.response?.data?.data) {
      for (const tweet of data.response.data.data) {
        tweets.push({
          id: tweet.id,
          text: tweet.text || '',
          authorUsername: tweet.author_id,
          createdAt: tweet.created_at || new Date().toISOString(),
          retweetCount: tweet.public_metrics?.retweet_count,
          likeCount: tweet.public_metrics?.like_count,
          replyCount: tweet.public_metrics?.reply_count,
          isRetweet: tweet.text?.startsWith('RT @'),
          isReply: tweet.in_reply_to_user_id != null,
        });
      }
    }

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
    // Get sync config
    const { data: config } = await supabase
      .from('twitter_sync_config')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    // Fetch tweets
    const tweets = await fetchTwitterTimeline(connectionId, 50);
    
    if (tweets.length === 0) {
      return { success: true, tweetsSynced: 0, memoriesCreated: 0 };
    }

    // Get user's API keys for LIAM
    const { data: apiKeys } = await supabase
      .from('user_api_keys')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!apiKeys) {
      return { success: false, tweetsSynced: 0, memoriesCreated: 0, error: 'API keys not configured' };
    }

    // Get already synced tweet IDs
    const { data: syncedPosts } = await supabase
      .from('twitter_synced_posts')
      .select('twitter_post_id')
      .eq('user_id', userId);

    const syncedIds = new Set((syncedPosts || []).map((p: { twitter_post_id: string }) => p.twitter_post_id));

    // Filter based on config
    const tweetsToSync = tweets.filter((tweet: Tweet) => {
      if (syncedIds.has(tweet.id)) return false;
      if (!config) return true; // Default to sync all if no config
      
      if (tweet.isRetweet && !config.sync_retweets) return false;
      if (tweet.isReply && !config.sync_replies) return false;
      if (!tweet.isRetweet && !tweet.isReply && !config.sync_tweets) return false;
      
      return true;
    });

    let memoriesCreated = 0;

    for (const tweet of tweetsToSync) {
      const memory = formatTweetAsMemory(tweet);
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
      console.error('LIAM API error:', await response.text());
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
