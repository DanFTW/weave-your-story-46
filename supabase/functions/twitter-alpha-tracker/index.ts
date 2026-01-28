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

interface TrackedAccount {
  username: string;
  userId: string;
  displayName?: string;
  avatarUrl?: string;
}

interface Tweet {
  id: string;
  text: string;
  createdAt: string;
  authorUsername: string;
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

// Search Twitter user by username
async function searchTwitterUser(connectionId: string, username: string): Promise<TrackedAccount | null> {
  try {
    console.log('Searching for Twitter user:', username);
    
    const response = await fetch('https://backend.composio.dev/api/v3/tools/execute/TWITTER_USER_LOOKUP_BY_USERNAME', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': COMPOSIO_API_KEY!,
      },
      body: JSON.stringify({
        connected_account_id: connectionId,
        arguments: {
          username: username.replace(/^@/, ''),
        },
      }),
    });

    if (!response.ok) {
      console.error('Failed to search user:', await response.text());
      return null;
    }

    const data = await response.json();
    const responseData = data?.data || data;
    
    // Extract user from various response formats
    const possiblePaths = [
      responseData?.response_data?.data,
      responseData?.response_data,
      responseData?.data,
      responseData,
    ];

    let user: any = null;
    for (const path of possiblePaths) {
      if (path && (path.username || path.id)) {
        user = path;
        break;
      }
    }
    
    if (user) {
      return {
        username: user.username || username,
        userId: user.id,
        displayName: user.name,
        avatarUrl: user.profile_image_url,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error searching Twitter user:', error);
    return null;
  }
}

// Fetch tweets from tracked user
async function fetchTrackedUserTweets(connectionId: string, trackedUsername: string): Promise<Tweet[]> {
  try {
    console.log('Fetching tweets from:', trackedUsername);
    
    const response = await fetch('https://backend.composio.dev/api/v3/tools/execute/TWITTER_RECENT_SEARCH', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': COMPOSIO_API_KEY!,
      },
      body: JSON.stringify({
        connected_account_id: connectionId,
        arguments: {
          query: `from:${trackedUsername}`,
          max_results: 50,
          'tweet.fields': 'created_at,public_metrics',
        },
      }),
    });

    if (!response.ok) {
      console.error('Failed to fetch tweets:', await response.text());
      return [];
    }

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

    const tweets: Tweet[] = tweetsData.map((tweet: any) => ({
      id: tweet.id || String(Date.now()),
      text: tweet.text || '',
      createdAt: tweet.created_at || new Date().toISOString(),
      authorUsername: trackedUsername,
    }));

    console.log('Fetched', tweets.length, 'tweets from', trackedUsername);
    return tweets;
  } catch (error) {
    console.error('Error fetching tweets:', error);
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

    console.log('Creating memory via LIAM API...');
    const response = await fetch(LIAM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apiKey': apiKeys.api_key,
        'signature': signature,
      },
      body: bodyString,
    });

    if (response.ok) {
      console.log('Memory created successfully');
      return true;
    } else {
      const errorText = await response.text();
      console.error('LIAM API error:', response.status, errorText);
      return false;
    }
  } catch (error) {
    console.error('Create memory error:', error);
    return false;
  }
}

// Format tweet as memory
function formatTweetAsMemory(tweet: Tweet): string {
  const date = new Date(tweet.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `Twitter Post from @${tweet.authorUsername}\n${date}\n\n${tweet.text}\n\nA post from an account you're tracking.`;
}

// Process tracked user posts
async function processTrackedUser(
  supabase: any, 
  userId: string, 
  config: any
): Promise<{ newPosts: number; postsTracked: number }> {
  try {
    if (!config.tracked_username) {
      console.log('No tracked username configured');
      return { newPosts: 0, postsTracked: config.posts_tracked || 0 };
    }

    const connectionId = await getConnectedAccountId(supabase, userId);
    if (!connectionId) {
      console.log(`No Twitter connection for user ${userId}`);
      return { newPosts: 0, postsTracked: config.posts_tracked || 0 };
    }

    // Get API keys
    const { data: apiKeys } = await supabase
      .from('user_api_keys')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!apiKeys) {
      console.log(`No API keys for user ${userId}`);
      return { newPosts: 0, postsTracked: config.posts_tracked || 0 };
    }

    // Fetch tweets from tracked user
    const tweets = await fetchTrackedUserTweets(connectionId, config.tracked_username);
    if (tweets.length === 0) {
      return { newPosts: 0, postsTracked: config.posts_tracked || 0 };
    }

    // Get already processed tweets
    const { data: processedPosts } = await supabase
      .from('twitter_alpha_processed_posts')
      .select('tweet_id')
      .eq('user_id', userId);

    const processedIds = new Set((processedPosts || []).map((p: any) => p.tweet_id));

    // Filter new tweets
    const newTweets = tweets.filter(t => !processedIds.has(t.id));
    console.log(`Found ${newTweets.length} new tweets from @${config.tracked_username}`);

    let newPosts = 0;

    for (const tweet of newTweets) {
      const memory = formatTweetAsMemory(tweet);
      const success = await createMemory(apiKeys, memory);

      if (success) {
        // Record as processed
        await supabase
          .from('twitter_alpha_processed_posts')
          .insert({
            user_id: userId,
            tweet_id: tweet.id,
          });

        newPosts++;
      }
    }

    // Update config stats
    const newPostsTracked = (config.posts_tracked || 0) + newPosts;
    await supabase
      .from('twitter_alpha_tracker_config')
      .update({
        last_polled_at: new Date().toISOString(),
        posts_tracked: newPostsTracked,
        updated_at: new Date().toISOString(),
      })
      .eq('id', config.id);

    return { newPosts, postsTracked: newPostsTracked };
  } catch (error) {
    console.error(`Error processing tracked user for ${userId}:`, error);
    return { newPosts: 0, postsTracked: config.posts_tracked || 0 };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const body = await req.json();
    const { action } = body;

    // Handle cron-triggered poll for all active users
    if (action === 'cron-poll') {
      const cronSecret = req.headers.get('x-cron-secret');
      if (cronSecret !== CRON_SECRET) {
        console.log('Cron poll: Invalid or missing secret');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Cron poll: Starting background sync for Twitter Alpha Tracker...');

      // Get all active configs
      const { data: activeConfigs, error: configError } = await supabase
        .from('twitter_alpha_tracker_config')
        .select('*')
        .eq('is_active', true);

      if (configError) {
        console.error('Cron poll: Error fetching configs:', configError);
        return new Response(JSON.stringify({ error: 'Failed to fetch configs' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Cron poll: Found ${activeConfigs?.length || 0} active trackers`);

      let totalNewPosts = 0;
      for (const config of activeConfigs || []) {
        try {
          console.log(`Cron poll: Processing tracker for user ${config.user_id}, tracking @${config.tracked_username}`);
          const result = await processTrackedUser(supabase, config.user_id, config);
          totalNewPosts += result.newPosts;
        } catch (err) {
          console.error(`Cron poll: Error processing user ${config.user_id}:`, err);
        }
      }

      console.log(`Cron poll: Complete. Total new posts: ${totalNewPosts}`);

      return new Response(JSON.stringify({ 
        success: true, 
        usersProcessed: activeConfigs?.length || 0,
        totalNewPosts,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Authenticated actions - get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
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

    const userId = user.id;

    // Search for Twitter user
    if (action === 'search-user') {
      const { username } = body;
      if (!username) {
        return new Response(JSON.stringify({ error: 'Username required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const connectionId = await getConnectedAccountId(supabase, userId);
      if (!connectionId) {
        return new Response(JSON.stringify({ error: 'Twitter not connected' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const user = await searchTwitterUser(connectionId, username);
      
      return new Response(JSON.stringify({ user }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Select account to track
    if (action === 'select-account') {
      const { account } = body;
      if (!account?.username || !account?.userId) {
        return new Response(JSON.stringify({ error: 'Account details required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Upsert config
      const { error } = await supabase
        .from('twitter_alpha_tracker_config')
        .upsert({
          user_id: userId,
          tracked_username: account.username,
          tracked_user_id: account.userId,
          tracked_display_name: account.displayName || null,
          tracked_avatar_url: account.avatarUrl || null,
          is_active: false,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) {
        console.error('Error saving account:', error);
        return new Response(JSON.stringify({ error: 'Failed to save account' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Activate tracking
    if (action === 'activate') {
      const { error } = await supabase
        .from('twitter_alpha_tracker_config')
        .update({
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error activating:', error);
        return new Response(JSON.stringify({ error: 'Failed to activate' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Deactivate tracking
    if (action === 'deactivate') {
      const { error } = await supabase
        .from('twitter_alpha_tracker_config')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error deactivating:', error);
        return new Response(JSON.stringify({ error: 'Failed to deactivate' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Manual poll
    if (action === 'manual-poll') {
      // Get config
      const { data: config, error: configError } = await supabase
        .from('twitter_alpha_tracker_config')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (configError || !config) {
        return new Response(JSON.stringify({ error: 'Config not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await processTrackedUser(supabase, userId, config);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
