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

// Delay utility for rate limiting
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Batch processing configuration
const BATCH_SIZE = 10; // Max tweets to process per poll
const MEMORY_CREATION_DELAY_MS = 500; // Delay between memory creations

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

// Detect if an error response indicates the connection needs re-authentication
function isReconnectError(responseText: string, status: number): { needsReconnect: boolean; reason: string } {
  const text = responseText.toLowerCase();
  if (status === 410 || text.includes('connectedaccountexpired') || text.includes('expired state')) {
    return { needsReconnect: true, reason: 'Your Twitter connection has expired. Please reconnect Twitter to continue.' };
  }
  if (status === 403 || text.includes('client-not-enrolled')) {
    return { needsReconnect: true, reason: 'Twitter app access is not configured correctly. Please reconnect Twitter.' };
  }
  return { needsReconnect: false, reason: '' };
}

interface SearchResult {
  user: TrackedAccount | null;
  needsReconnect?: boolean;
  error?: string;
}

// Search Twitter user by username
async function searchTwitterUser(connectionId: string, username: string): Promise<SearchResult> {
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

    const responseText = await response.text();
    console.log('Search user response status:', response.status);
    console.log('Search user response (first 1000 chars):', responseText.substring(0, 1000));

    // Check for reconnect-worthy errors
    const reconnectCheck = isReconnectError(responseText, response.status);
    if (reconnectCheck.needsReconnect) {
      console.error('Twitter connection needs reconnect:', reconnectCheck.reason);
      return { user: null, needsReconnect: true, error: reconnectCheck.reason };
    }

    if (!response.ok) {
      console.error('Failed to search user, status:', response.status);
      return { user: null };
    }

    const result = JSON.parse(responseText);

    // Check for error in response body (Composio can return 200 with error)
    if (result.error) {
      console.error('Composio returned error in body:', JSON.stringify(result.error));
      const bodyReconnect = isReconnectError(JSON.stringify(result.error), result.error?.status || 0);
      if (bodyReconnect.needsReconnect) {
        return { user: null, needsReconnect: true, error: bodyReconnect.reason };
      }
      return { user: null };
    }

    // Align with proven parsing pattern from composio-callback
    const data = result.data || result.response_data || result;
    if (data.error) {
      console.error('Composio returned error in data:', JSON.stringify(data.error));
      const dataReconnect = isReconnectError(JSON.stringify(data.error), data.error?.status || 0);
      if (dataReconnect.needsReconnect) {
        return { user: null, needsReconnect: true, error: dataReconnect.reason };
      }
      return { user: null };
    }

    const userData = data.response_data?.data || data.data || data;
    
    if (userData && (userData.username || userData.id)) {
      return {
        user: {
          username: userData.username || username,
          userId: userData.id,
          displayName: userData.name,
          avatarUrl: userData.profile_image_url,
        },
      };
    }

    console.warn('No valid user data found in response');
    return { user: null };
  } catch (error) {
    console.error('Error searching Twitter user:', error);
    return { user: null };
  }
}

// Fetch tweets from multiple tracked users
async function fetchMultipleUsersTweets(connectionId: string, usernames: string[]): Promise<Tweet[]> {
  try {
    if (usernames.length === 0) return [];
    
    // Build query with OR for multiple users
    const query = usernames.map(u => `from:${u}`).join(' OR ');
    console.log('Fetching tweets with query:', query);
    
    const response = await fetch('https://backend.composio.dev/api/v3/tools/execute/TWITTER_RECENT_SEARCH', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': COMPOSIO_API_KEY!,
      },
      body: JSON.stringify({
        connected_account_id: connectionId,
        arguments: {
          query,
          max_results: 100,
          'tweet.fields': 'created_at,public_metrics,author_id',
          expansions: ['author_id'],
        },
      }),
    });

    // Log raw response for debugging
    const responseText = await response.text();
    console.log('Twitter API response status:', response.status);
    console.log('Twitter API response (first 2000 chars):', responseText.slice(0, 2000));

    // Check for rate limit
    if (response.status === 429) {
      console.log('Twitter API rate limit hit - will retry on next poll');
      return [];
    }

    if (!response.ok) {
      console.error('Failed to fetch tweets:', responseText);
      return [];
    }

    const data = JSON.parse(responseText);
    const responseData = data?.data || data;
    
    // Log response structure for debugging
    console.log('Response structure keys:', Object.keys(responseData || {}));
    if (responseData?.response_data) {
      console.log('response_data keys:', Object.keys(responseData.response_data || {}));
      const resultCount = responseData.response_data?.meta?.result_count;
      console.log('result_count from meta:', resultCount);
    }

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

    // Log result count from API
    const apiResultCount = responseData?.response_data?.meta?.result_count || 
                           responseData?.meta?.result_count || 0;
    console.log(`Twitter API returned ${apiResultCount} results for query`);

    // Try to get user mapping for author usernames
    const usersData = responseData?.response_data?.includes?.users || 
                      responseData?.includes?.users || 
                      [];
    const userMap = new Map<string, string>(usersData.map((u: any) => [u.id, u.username]));

    const tweets: Tweet[] = tweetsData.map((tweet: any) => ({
      id: tweet.id || String(Date.now()),
      text: tweet.text || '',
      createdAt: tweet.created_at || new Date().toISOString(),
      authorUsername: userMap.get(tweet.author_id) as string || 'unknown',
    }));

    console.log('Fetched', tweets.length, 'tweets from', usernames.length, 'accounts');
    
    if (tweets.length === 0) {
      console.log(`No tweets found in last 7 days for accounts: ${usernames.join(', ')}`);
      console.log('This is expected if tracked accounts have not posted recently');
    }
    
    return tweets;
  } catch (error) {
    console.error('Error fetching tweets:', error);
    return [];
  }
}

// Create memory via LIAM API with enhanced logging
async function createMemory(apiKeys: { api_key: string; private_key: string; user_key: string }, content: string): Promise<boolean> {
  try {
    console.log(`[Memory] Creating memory, content length: ${content.length}`);
    console.log(`[Memory] Preview: ${content.slice(0, 150)}...`);
    
    const requestBody = {
      content,
      userKey: apiKeys.user_key,
      tag: 'TWITTER',
    };
    
    const bodyString = JSON.stringify(requestBody);
    const signature = await signRequest(apiKeys.private_key, bodyString);

    console.log('[Memory] Sending request to LIAM API...');
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

    if (response.ok) {
      console.log(`[Memory] SUCCESS - Status: ${response.status}`);
      console.log(`[Memory] SUCCESS - Response: ${responseText.slice(0, 200)}`);
      return true;
    } else {
      // Log full error details for debugging
      console.error(`[Memory] FAILED - Status: ${response.status}`);
      console.error(`[Memory] FAILED - Response: ${responseText}`);
      console.error(`[Memory] FAILED - Content was: ${content.slice(0, 300)}`);
      return false;
    }
  } catch (error) {
    console.error(`[Memory] EXCEPTION: ${error}`);
    return false;
  }
}

// Format tweet as memory - structured format for LIAM tokenization
function formatTweetAsMemory(tweet: Tweet): string {
  const date = new Date(tweet.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let memory = `Twitter/X Post from @${tweet.authorUsername}`;
  memory += `\nPosted on ${date}\n\n`;
  
  // Quote the tweet text for clear extraction
  if (tweet.text) {
    memory += `"${tweet.text}"\n\n`;
  }
  
  // Add explicit metadata for LIAM tokenization
  memory += `This is a tracked post from @${tweet.authorUsername} on Twitter/X.`;
  
  // Include post ID for reference (will be stripped in UI display)
  memory += `\n\n[tweet_id:${tweet.id}]`;

  return memory;
}

// Process all tracked users for a given user
async function processTrackedUsers(
  supabase: any, 
  userId: string
): Promise<{ newPosts: number; totalPostsTracked: number }> {
  try {
    // Get all tracked accounts
    const { data: trackedAccounts, error: accountsError } = await supabase
      .from('twitter_alpha_tracked_accounts')
      .select('*')
      .eq('user_id', userId);

    if (accountsError || !trackedAccounts || trackedAccounts.length === 0) {
      console.log('No tracked accounts for user', userId);
      return { newPosts: 0, totalPostsTracked: 0 };
    }

    const connectionId = await getConnectedAccountId(supabase, userId);
    if (!connectionId) {
      console.log(`No Twitter connection for user ${userId}`);
      return { newPosts: 0, totalPostsTracked: trackedAccounts.reduce((sum: number, a: any) => sum + (a.posts_tracked || 0), 0) };
    }

    // Get API keys
    const { data: apiKeys } = await supabase
      .from('user_api_keys')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!apiKeys) {
      console.log(`No API keys for user ${userId}`);
      return { newPosts: 0, totalPostsTracked: trackedAccounts.reduce((sum: number, a: any) => sum + (a.posts_tracked || 0), 0) };
    }

    // Build list of usernames
    const usernames = trackedAccounts.map((a: any) => a.username);
    
    // Fetch tweets from all tracked users
    const tweets = await fetchMultipleUsersTweets(connectionId, usernames);
    if (tweets.length === 0) {
      return { newPosts: 0, totalPostsTracked: trackedAccounts.reduce((sum: number, a: any) => sum + (a.posts_tracked || 0), 0) };
    }

    // Get already processed tweets
    const { data: processedPosts } = await supabase
      .from('twitter_alpha_processed_posts')
      .select('tweet_id')
      .eq('user_id', userId);

    const processedIds = new Set((processedPosts || []).map((p: any) => p.tweet_id));

    // Filter new tweets
    const newTweets = tweets.filter(t => !processedIds.has(t.id));
    console.log(`Found ${newTweets.length} new tweets from ${usernames.length} accounts`);

    // Batch processing - limit tweets per poll to avoid timeouts and rate limits
    const tweetsToProcess = newTweets.slice(0, BATCH_SIZE);
    console.log(`Processing ${tweetsToProcess.length} of ${newTweets.length} new tweets (batch limit: ${BATCH_SIZE})`);
    
    if (newTweets.length > BATCH_SIZE) {
      console.log(`Remaining ${newTweets.length - BATCH_SIZE} tweets will be processed in subsequent polls`);
    }

    let newPosts = 0;
    const postsByAuthor: Record<string, number> = {};

    for (let i = 0; i < tweetsToProcess.length; i++) {
      const tweet = tweetsToProcess[i];
      
      // STEP 1: Store tweet locally for reliable 1:1 retrieval (source of truth)
      const { error: insertError } = await supabase
        .from('twitter_alpha_posts')
        .upsert({
          user_id: userId,
          tweet_id: tweet.id,
          author_username: tweet.authorUsername,
          author_display_name: null, // Can be enhanced later
          tweet_text: tweet.text,
          tweet_created_at: tweet.createdAt,
        }, {
          onConflict: 'user_id,tweet_id',
        });

      if (insertError) {
        console.error(`[Storage] Failed to store tweet ${tweet.id}:`, insertError);
        continue; // Skip this tweet if storage fails
      }
      
      console.log(`[Storage] Tweet ${tweet.id} stored locally`);

      // STEP 2: Send to LIAM API for semantic search (fire-and-forget, don't block on failure)
      const memory = formatTweetAsMemory(tweet);
      const memorySuccess = await createMemory(apiKeys, memory);
      
      if (!memorySuccess) {
        console.log(`[Memory] LIAM API failed for tweet ${tweet.id} - post is still stored locally`);
      }

      // STEP 3: Mark as processed (we have local storage, so always mark as processed)
      await supabase
        .from('twitter_alpha_processed_posts')
        .upsert({
          user_id: userId,
          tweet_id: tweet.id,
        }, {
          onConflict: 'user_id,tweet_id',
        });

      newPosts++;
      postsByAuthor[tweet.authorUsername] = (postsByAuthor[tweet.authorUsername] || 0) + 1;
      
      // Add delay between memory creations to avoid rate limiting
      if (i < tweetsToProcess.length - 1) {
        console.log(`[RateLimit] Waiting ${MEMORY_CREATION_DELAY_MS}ms before next tweet...`);
        await delay(MEMORY_CREATION_DELAY_MS);
      }
    }

    // Update per-account stats
    for (const [username, count] of Object.entries(postsByAuthor)) {
      const account = trackedAccounts.find((a: any) => a.username === username);
      if (account) {
        await supabase
          .from('twitter_alpha_tracked_accounts')
          .update({
            posts_tracked: (account.posts_tracked || 0) + count,
            updated_at: new Date().toISOString(),
          })
          .eq('id', account.id);
      }
    }

    // Update global config
    const { data: config } = await supabase
      .from('twitter_alpha_tracker_config')
      .select('posts_tracked')
      .eq('user_id', userId)
      .maybeSingle();

    await supabase
      .from('twitter_alpha_tracker_config')
      .update({
        last_polled_at: new Date().toISOString(),
        posts_tracked: (config?.posts_tracked || 0) + newPosts,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    // Calculate total
    const totalPostsTracked = trackedAccounts.reduce((sum: number, a: any) => {
      const additional = postsByAuthor[a.username] || 0;
      return sum + (a.posts_tracked || 0) + additional;
    }, 0);

    return { newPosts, totalPostsTracked };
  } catch (error) {
    console.error(`Error processing tracked users for ${userId}:`, error);
    return { newPosts: 0, totalPostsTracked: 0 };
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
      const cronTrigger = req.headers.get('x-cron-trigger');
      
      // Accept either: matching secret OR internal cron trigger header
      const validSecret = cronSecret && cronSecret === CRON_SECRET;
      const validTrigger = cronTrigger === 'supabase-internal';
      
      if (!validSecret && !validTrigger) {
        console.log('Cron poll: Invalid or missing authentication');
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
          console.log(`Cron poll: Processing tracker for user ${config.user_id}`);
          const result = await processTrackedUsers(supabase, config.user_id);
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

      const searchResult = await searchTwitterUser(connectionId, username);
      
      return new Response(JSON.stringify(searchResult), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Add multiple accounts to track
    if (action === 'add-accounts') {
      const { accounts } = body;
      if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
        return new Response(JSON.stringify({ error: 'Accounts array required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Ensure config exists
      await supabase
        .from('twitter_alpha_tracker_config')
        .upsert({
          user_id: userId,
          is_active: false,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      // Insert accounts (ignore duplicates)
      for (const account of accounts) {
        if (!account.username || !account.userId) continue;

        await supabase
          .from('twitter_alpha_tracked_accounts')
          .upsert({
            user_id: userId,
            username: account.username,
            user_id_twitter: account.userId,
            display_name: account.displayName || null,
            avatar_url: account.avatarUrl || null,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,username',
          });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Remove account from tracking
    if (action === 'remove-account') {
      const { username } = body;
      if (!username) {
        return new Response(JSON.stringify({ error: 'Username required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error } = await supabase
        .from('twitter_alpha_tracked_accounts')
        .delete()
        .eq('user_id', userId)
        .eq('username', username);

      if (error) {
        console.error('Error removing account:', error);
        return new Response(JSON.stringify({ error: 'Failed to remove account' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Legacy: Select single account (for backward compatibility)
    if (action === 'select-account') {
      const { account } = body;
      if (!account?.username || !account?.userId) {
        return new Response(JSON.stringify({ error: 'Account details required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Ensure config exists
      await supabase
        .from('twitter_alpha_tracker_config')
        .upsert({
          user_id: userId,
          is_active: false,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      // Add to tracked accounts
      await supabase
        .from('twitter_alpha_tracked_accounts')
        .upsert({
          user_id: userId,
          username: account.username,
          user_id_twitter: account.userId,
          display_name: account.displayName || null,
          avatar_url: account.avatarUrl || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,username',
        });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Activate tracking
    if (action === 'activate') {
      const { error } = await supabase
        .from('twitter_alpha_tracker_config')
        .upsert({
          user_id: userId,
          is_active: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

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
      try {
        const result = await processTrackedUsers(supabase, userId);

        // Check if the result contains tweet-fetch errors indicating expired connection
        if (result && typeof result === 'object' && 'error' in result) {
          const errStr = JSON.stringify(result);
          const reconnectCheck = isReconnectError(errStr, 0);
          if (reconnectCheck.needsReconnect) {
            return new Response(JSON.stringify({ needsReconnect: true, error: reconnectCheck.reason }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (pollError) {
        const errStr = String(pollError);
        const reconnectCheck = isReconnectError(errStr, 0);
        if (reconnectCheck.needsReconnect) {
          return new Response(JSON.stringify({ needsReconnect: true, error: reconnectCheck.reason }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw pollError;
      }
    }

    // List locally stored Twitter posts
    if (action === 'list-posts') {
      const { data: posts, error: listError } = await supabase
        .from('twitter_alpha_posts')
        .select('*')
        .eq('user_id', userId)
        .order('tweet_created_at', { ascending: false })
        .limit(200);

      if (listError) {
        console.error('Error listing posts:', listError);
        return new Response(JSON.stringify({ error: 'Failed to fetch posts' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ posts: posts || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Reset sync - clears all processed posts AND local storage to allow re-sync
    if (action === 'reset-sync') {
      console.log(`Reset sync requested for user ${userId}`);
      
      // Clear all processed posts for this user
      const { error: deleteProcessedError } = await supabase
        .from('twitter_alpha_processed_posts')
        .delete()
        .eq('user_id', userId);
      
      if (deleteProcessedError) {
        console.error('Error clearing processed posts:', deleteProcessedError);
        return new Response(JSON.stringify({ error: 'Failed to clear processed posts' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Clear locally stored posts
      const { error: deleteLocalError } = await supabase
        .from('twitter_alpha_posts')
        .delete()
        .eq('user_id', userId);
      
      if (deleteLocalError) {
        console.error('Error clearing local posts:', deleteLocalError);
        // Continue anyway - processed posts are the critical ones
      }
      
      // Reset stats in config
      await supabase
        .from('twitter_alpha_tracker_config')
        .update({ 
          posts_tracked: 0, 
          last_polled_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
      
      // Reset per-account stats
      await supabase
        .from('twitter_alpha_tracked_accounts')
        .update({ 
          posts_tracked: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      console.log('Sync history and local storage cleared successfully');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Sync history cleared. Next poll will re-process all tweets.' 
      }), {
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
