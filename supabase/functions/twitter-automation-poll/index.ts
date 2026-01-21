import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const COMPOSIO_API_KEY = Deno.env.get('COMPOSIO_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const CRON_SECRET = Deno.env.get('CRON_SECRET');
const LIAM_API_URL = 'https://web.askbuddy.ai/devspacexdb/api/memory/create';

interface Tweet {
  id: string;
  text: string;
  authorUsername?: string;
  createdAt: string;
  isRetweet?: boolean;
  isReply?: boolean;
  isLike?: boolean;
}

interface AutomationConfig {
  id: string;
  user_id: string;
  monitor_new_posts: boolean;
  monitor_replies: boolean;
  monitor_retweets: boolean;
  monitor_likes: boolean;
  is_active: boolean;
  posts_tracked: number;
  replies_tracked: number;
  retweets_tracked: number;
  likes_tracked: number;
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

// Get connected account ID for a user
async function getConnectedAccountId(supabase: any, userId: string): Promise<string | null> {
  const { data: integration } = await supabase
    .from('user_integrations')
    .select('composio_connection_id')
    .eq('user_id', userId)
    .eq('integration_id', 'twitter')
    .eq('status', 'connected')
    .maybeSingle();

  return integration?.composio_connection_id || null;
}

// Get Twitter user info using Composio v3 API
async function getTwitterUserInfo(connectionId: string): Promise<{ username: string; userId: string } | null> {
  try {
    console.log('Fetching Twitter user info...');
    
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

    if (!response.ok) {
      console.error('Failed to get user info:', await response.text());
      return null;
    }

    const data = await response.json();
    const responseData = data?.data || data;
    
    const username = responseData?.response_data?.data?.username || 
                     responseData?.response_data?.username ||
                     responseData?.data?.username ||
                     responseData?.username;
    const userId = responseData?.response_data?.data?.id ||
                   responseData?.response_data?.id ||
                   responseData?.data?.id ||
                   responseData?.id;
    
    if (username && userId) {
      return { username, userId };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting Twitter user info:', error);
    return null;
  }
}

// Fetch tweets using Composio v3 API
async function fetchTwitterContent(connectionId: string, config: AutomationConfig): Promise<Tweet[]> {
  const tweets: Tweet[] = [];
  
  try {
    const userInfo = await getTwitterUserInfo(connectionId);
    if (!userInfo) {
      console.error('Could not get Twitter username');
      return [];
    }
    
    console.log('Fetching tweets for user:', userInfo.username);
    
    // Fetch user's tweets using TWITTER_RECENT_SEARCH
    if (config.monitor_new_posts || config.monitor_replies || config.monitor_retweets) {
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
            max_results: 50,
            'tweet.fields': 'created_at,public_metrics,referenced_tweets,in_reply_to_user_id',
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const responseData = data?.data || data;
        
        // Parse tweets from response
        const possiblePaths = [
          responseData?.response_data?.data,
          responseData?.response_data,
          responseData?.data?.data,
          responseData?.data,
        ];

        let tweetsData: any[] = [];
        for (const path of possiblePaths) {
          if (Array.isArray(path) && path.length > 0) {
            tweetsData = path;
            break;
          }
        }

        for (const tweet of tweetsData) {
          const isRetweet = (tweet.text || '').startsWith('RT @');
          const isReply = tweet.in_reply_to_user_id != null;
          
          // Filter based on config
          if (isRetweet && !config.monitor_retweets) continue;
          if (isReply && !config.monitor_replies) continue;
          if (!isRetweet && !isReply && !config.monitor_new_posts) continue;
          
          tweets.push({
            id: tweet.id || String(Date.now()),
            text: tweet.text || '',
            authorUsername: userInfo.username,
            createdAt: tweet.created_at || new Date().toISOString(),
            isRetweet,
            isReply,
          });
        }
      }
    }

    // Fetch likes if enabled
    if (config.monitor_likes) {
      const likesResponse = await fetch('https://backend.composio.dev/api/v3/tools/execute/TWITTER_RETURNS_POST_OBJECTS_LIKED_BY_THE_PROVIDED_USER_ID', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': COMPOSIO_API_KEY!,
        },
        body: JSON.stringify({
          connected_account_id: connectionId,
          arguments: {
            id: userInfo.userId,
            max_results: 20,
          },
        }),
      });

      if (likesResponse.ok) {
        const likesData = await likesResponse.json();
        const responseData = likesData?.data || likesData;
        
        const possiblePaths = [
          responseData?.response_data?.data,
          responseData?.response_data,
          responseData?.data?.data,
          responseData?.data,
        ];

        let likesArray: any[] = [];
        for (const path of possiblePaths) {
          if (Array.isArray(path) && path.length > 0) {
            likesArray = path;
            break;
          }
        }

        for (const like of likesArray) {
          tweets.push({
            id: `like_${like.id || Date.now()}`,
            text: like.text || '',
            authorUsername: like.author_username || 'unknown',
            createdAt: like.created_at || new Date().toISOString(),
            isLike: true,
          });
        }
      }
    }

    console.log('Fetched total items:', tweets.length);
    return tweets;
  } catch (error) {
    console.error('Error fetching Twitter content:', error);
    return [];
  }
}

// Create memory via LIAM API
async function createMemory(apiKeys: { api_key: string; private_key: string; user_key: string }, content: string): Promise<boolean> {
  try {
    const requestBody = {
      content,
      userKey: apiKeys.user_key,
      tag: 'TWITTER',
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

    return response.ok;
  } catch (error) {
    console.error('Create memory error:', error);
    return false;
  }
}

// Format tweet as memory string
function formatTweetAsMemory(tweet: Tweet): string {
  const date = new Date(tweet.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let type = 'Tweet';
  if (tweet.isRetweet) type = 'Retweet';
  if (tweet.isReply) type = 'Reply';
  if (tweet.isLike) type = 'Liked Tweet';

  let memory = `Twitter ${type}\n${date}`;
  if (tweet.authorUsername) {
    memory += tweet.isLike ? `\nLiked from @${tweet.authorUsername}` : `\nby @${tweet.authorUsername}`;
  }
  memory += '\n\n' + tweet.text;

  return memory;
}

// Process Twitter activity for a user
async function processUserTwitter(supabase: any, userId: string, config: AutomationConfig): Promise<{ newItems: number }> {
  try {
    const connectionId = await getConnectedAccountId(supabase, userId);
    if (!connectionId) {
      console.log(`No Twitter connection for user ${userId}`);
      return { newItems: 0 };
    }

    // Get API keys
    const { data: apiKeys } = await supabase
      .from('user_api_keys')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!apiKeys) {
      console.log(`No API keys for user ${userId}`);
      return { newItems: 0 };
    }

    // Fetch Twitter content
    const tweets = await fetchTwitterContent(connectionId, config);
    if (tweets.length === 0) {
      return { newItems: 0 };
    }

    // Get already processed items
    const { data: processedItems } = await supabase
      .from('twitter_processed_engagement')
      .select('twitter_item_id')
      .eq('user_id', userId);

    const processedIds = new Set((processedItems || []).map((p: any) => p.twitter_item_id));

    // Filter new items
    const newTweets = tweets.filter(t => !processedIds.has(t.id));
    console.log(`Found ${newTweets.length} new items for user ${userId}`);

    let newItems = 0;
    let postsAdded = 0, repliesAdded = 0, retweetsAdded = 0, likesAdded = 0;

    for (const tweet of newTweets) {
      const memory = formatTweetAsMemory(tweet);
      const success = await createMemory(apiKeys, memory);

      if (success) {
        // Record as processed
        await supabase
          .from('twitter_processed_engagement')
          .insert({
            user_id: userId,
            twitter_item_id: tweet.id,
            engagement_type: tweet.isLike ? 'like' : (tweet.isRetweet ? 'retweet' : (tweet.isReply ? 'reply' : 'post')),
          });

        newItems++;
        if (tweet.isLike) likesAdded++;
        else if (tweet.isRetweet) retweetsAdded++;
        else if (tweet.isReply) repliesAdded++;
        else postsAdded++;
      }
    }

    // Update config stats
    await supabase
      .from('twitter_automation_config')
      .update({
        last_polled_at: new Date().toISOString(),
        posts_tracked: config.posts_tracked + postsAdded,
        replies_tracked: config.replies_tracked + repliesAdded,
        retweets_tracked: config.retweets_tracked + retweetsAdded,
        likes_tracked: config.likes_tracked + likesAdded,
        updated_at: new Date().toISOString(),
      })
      .eq('id', config.id);

    return { newItems };
  } catch (error) {
    console.error(`Error processing Twitter for user ${userId}:`, error);
    return { newItems: 0 };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { action } = await req.json();

    // Handle cron-triggered poll for all active users
    if (action === 'cron-poll') {
      const cronSecret = req.headers.get('x-cron-secret');
      if (cronSecret !== CRON_SECRET) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get all active automation configs
      const { data: activeConfigs } = await supabase
        .from('twitter_automation_config')
        .select('*')
        .eq('is_active', true);

      const results = [];
      for (const config of activeConfigs || []) {
        const result = await processUserTwitter(supabase, config.user_id, config);
        results.push({ userId: config.user_id, ...result });
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For user-initiated actions, verify auth
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

    // Get user's config
    const { data: config } = await supabase
      .from('twitter_automation_config')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    switch (action) {
      case 'activate': {
        if (config) {
          await supabase
            .from('twitter_automation_config')
            .update({ is_active: true, updated_at: new Date().toISOString() })
            .eq('id', config.id);
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'deactivate': {
        if (config) {
          await supabase
            .from('twitter_automation_config')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', config.id);
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'manual-poll': {
        if (!config) {
          return new Response(JSON.stringify({ error: 'No config found' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const result = await processUserTwitter(supabase, user.id, config);
        return new Response(JSON.stringify({ success: true, ...result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'stats': {
        return new Response(JSON.stringify({
          success: true,
          stats: config ? {
            postsTracked: config.posts_tracked,
            repliesTracked: config.replies_tracked,
            retweetsTracked: config.retweets_tracked,
            likesTracked: config.likes_tracked,
            lastPolledAt: config.last_polled_at,
            isActive: config.is_active,
          } : null,
        }), {
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
    console.error('Twitter automation poll error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal server error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
