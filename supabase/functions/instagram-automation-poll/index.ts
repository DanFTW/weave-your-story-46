import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret, x-cron-trigger",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const LIAM_API_BASE = "https://web.askbuddy.ai/devspacexdb/api/memory";

// Batch processing configuration (matching Twitter Alpha Tracker pattern)
const BATCH_SIZE = 10;
const MEMORY_CREATION_DELAY_MS = 500;

interface InstagramPost {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
  children?: { data: Array<{ id: string; media_url?: string; media_type?: string }> };
}

interface InstagramComment {
  id: string;
  text: string;
  timestamp?: string;
  username?: string;
  from?: { username: string; id: string };
}

interface AutomationConfig {
  user_id: string;
  is_active: boolean;
  monitor_new_posts: boolean;
  monitor_comments: boolean;
  monitor_likes: boolean;
  posts_tracked: number;
  comments_tracked: number;
  likes_tracked: number;
}

// Delay utility for rate limiting
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// === CRYPTO UTILITIES FOR LIAM API (FIXED: Handles PKCS#8 format) ===

function removeLeadingZeros(bytes: Uint8Array): Uint8Array {
  let i = 0;
  while (i < bytes.length - 1 && bytes[i] === 0) i++;
  return bytes.slice(i);
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

  const innerLength = 1 + rLen.length + rPadded.length + 1 + sLen.length + sPadded.length;
  const seqLen = constructLength(innerLength);

  const der = new Uint8Array(1 + seqLen.length + innerLength);
  let offset = 0;
  der[offset++] = 0x30;
  der.set(seqLen, offset);
  offset += seqLen.length;
  der[offset++] = 0x02;
  der.set(rLen, offset);
  offset += rLen.length;
  der.set(rPadded, offset);
  offset += rPadded.length;
  der[offset++] = 0x02;
  der.set(sLen, offset);
  offset += sLen.length;
  der.set(sPadded, offset);

  return der;
}

// FIXED: Handles PKCS#8 format (-----BEGIN PRIVATE KEY-----) 
// instead of expecting EC PRIVATE KEY format
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

// === COMPOSIO API HELPERS ===

async function getConnectedAccountId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("user_integrations")
    .select("composio_connection_id")
    .eq("user_id", userId)
    .eq("integration_id", "instagram")
    .eq("status", "connected")
    .maybeSingle();

  return data?.composio_connection_id || null;
}

// Get Instagram User ID (required for media API calls)
async function getInstagramUserId(connectionId: string): Promise<string | null> {
  try {
    console.log("Fetching Instagram user ID...");
    
    const response = await fetch("https://backend.composio.dev/api/v3/tools/execute/INSTAGRAM_GET_USER_INFO", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": COMPOSIO_API_KEY,
      },
      body: JSON.stringify({
        connected_account_id: connectionId,
        arguments: {},
      }),
    });

    const responseText = await response.text();
    console.log("Instagram user info response status:", response.status);

    if (!response.ok) {
      console.error("Composio API error getting user info:", response.status, responseText);
      return null;
    }

    const data = JSON.parse(responseText);
    const responseData = data.data || data;
    const userId = responseData?.id || 
                   responseData?.response_data?.id || 
                   responseData?.user?.id ||
                   responseData?.ig_user_id;
    
    console.log("Found Instagram user ID:", userId);
    return userId || null;
  } catch (error) {
    console.error("Error getting Instagram user ID:", error);
    return null;
  }
}

async function fetchInstagramPosts(connectedAccountId: string, igUserId: string | null, limit = 25): Promise<InstagramPost[]> {
  console.log(`Fetching Instagram posts, igUserId: ${igUserId}, limit: ${limit}`);
  
  const response = await fetch("https://backend.composio.dev/api/v3/tools/execute/INSTAGRAM_GET_USER_MEDIA", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": COMPOSIO_API_KEY,
    },
    body: JSON.stringify({
      connected_account_id: connectedAccountId,
      arguments: {
        ...(igUserId && { ig_user_id: igUserId }),
        limit,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Composio API error fetching posts:", response.status, errorText);
    
    // Detect expired/disconnected connections (410 Gone)
    if (response.status === 410 || errorText.includes('EXPIRED')) {
      const expiredError = new Error('CONNECTION_EXPIRED');
      (expiredError as any).code = 'CONNECTION_EXPIRED';
      throw expiredError;
    }
    
    throw new Error(`Failed to fetch posts: ${response.statusText}`);
  }

  const data = await response.json();
  const responseData = data.data || data;
  
  let mediaData = responseData?.response_data?.data ||
                  responseData?.response_data ||
                  responseData?.data ||
                  responseData?.media?.data ||
                  responseData;
  
  if (mediaData && typeof mediaData === "object" && !Array.isArray(mediaData)) {
    mediaData = mediaData.data || mediaData.media || [];
  }
  
  if (!Array.isArray(mediaData)) {
    console.log("Media data is not an array");
    return [];
  }
  
  console.log(`Found ${mediaData.length} Instagram posts`);
  
  return mediaData.slice(0, limit).map((item: any) => ({
    id: item.id,
    caption: item.caption,
    media_type: item.media_type || item.mediaType,
    media_url: item.media_url || item.mediaUrl,
    thumbnail_url: item.thumbnail_url || item.thumbnailUrl,
    permalink: item.permalink || item.permalinkUrl,
    timestamp: item.timestamp,
    like_count: item.like_count || item.likesCount,
    comments_count: item.comments_count || item.commentsCount,
    children: item.children,
  }));
}

async function fetchPostComments(connectedAccountId: string, postId: string): Promise<InstagramComment[]> {
  try {
    console.log(`Fetching comments for post ${postId}...`);
    
    const response = await fetch("https://backend.composio.dev/api/v3/tools/execute/INSTAGRAM_GET_IG_MEDIA_COMMENTS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": COMPOSIO_API_KEY,
      },
      body: JSON.stringify({
        connected_account_id: connectedAccountId,
        arguments: { 
          ig_media_id: postId,
          limit: 50,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error fetching comments:", response.status, errorText);
      return [];
    }

    const data = await response.json();
    const responseData = data?.data || data;
    let commentsData = responseData?.response_data?.data ||
                       responseData?.response_data?.comments?.data ||
                       responseData?.data ||
                       responseData?.comments?.data ||
                       responseData?.comments ||
                       responseData;

    if (commentsData && typeof commentsData === "object" && !Array.isArray(commentsData)) {
      commentsData = commentsData.data || [];
    }

    if (!Array.isArray(commentsData)) {
      return [];
    }

    console.log(`Found ${commentsData.length} comments for post ${postId}`);
    
    return commentsData.map((c: any) => ({
      id: c.id,
      text: c.text,
      timestamp: c.timestamp,
      username: c.username,
      from: c.from ? { id: c.from.id, username: c.from.username } : undefined,
    }));
  } catch (error) {
    console.error("Error fetching comments:", error);
    return [];
  }
}

// === LIAM MEMORY API (FIXED SIGNING) ===

async function createMemory(apiKeys: any, content: string): Promise<boolean> {
  try {
    console.log(`[Memory] Creating memory, content length: ${content.length}`);
    console.log(`[Memory] Preview: ${content.slice(0, 150)}...`);

    const requestBody = {
      content,
      userKey: apiKeys.user_key,
      tag: 'INSTAGRAM',
    };

    const bodyString = JSON.stringify(requestBody);
    const signature = await signRequest(apiKeys.private_key, bodyString);

    console.log('[Memory] Sending request to LIAM API...');
    const response = await fetch(`${LIAM_API_BASE}/create`, {
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
      console.error(`[Memory] FAILED - Status: ${response.status}`);
      console.error(`[Memory] FAILED - Response: ${responseText}`);
      return false;
    }
  } catch (error) {
    console.error(`[Memory] EXCEPTION: ${error}`);
    return false;
  }
}

// === HYBRID STORAGE: Store posts locally for reliable 1:1 display ===

async function storePostLocally(
  supabase: any,
  userId: string,
  post: InstagramPost,
  imageUrl: string | null
): Promise<void> {
  try {
    const { error } = await supabase.from('instagram_synced_post_content').upsert({
      user_id: userId,
      instagram_post_id: post.id,
      caption: post.caption || null,
      media_type: post.media_type || null,
      media_url: imageUrl,
      permalink_url: post.permalink || null,
      username: null, // Could be fetched if needed
      likes_count: post.like_count || null,
      comments_count: post.comments_count || null,
      posted_at: post.timestamp || null,
    }, {
      onConflict: 'user_id,instagram_post_id',
    });

    if (error) {
      console.error(`[Storage] Failed to store post ${post.id}:`, error);
    } else {
      console.log(`[Storage] Post ${post.id} stored locally`);
    }
  } catch (err) {
    console.error(`[Storage] Exception storing post ${post.id}:`, err);
  }
}

// Format post as memory content
function formatPostAsMemory(post: InstagramPost): string {
  const parts = [
    `📸 Instagram Post`,
    post.caption ? `"${post.caption}"` : "",
    post.like_count ? `❤️ ${post.like_count} likes` : "",
    post.comments_count ? `💬 ${post.comments_count} comments` : "",
    post.media_url || post.thumbnail_url ? `[media:${post.media_url || post.thumbnail_url}]` : "",
    post.permalink ? `[link:${post.permalink}]` : "",
  ];
  return parts.filter(Boolean).join("\n");
}

// === SHARED POLLING LOGIC ===

async function processUserInstagram(
  supabase: any,
  userId: string,
  config: AutomationConfig
): Promise<{ newItems: number; postsTracked: number; commentsTracked: number; likesTracked: number }> {
  // Get connected account
  const connectedAccountId = await getConnectedAccountId(supabase, userId);
  if (!connectedAccountId) {
    console.log(`User ${userId}: Instagram not connected, skipping`);
    return { newItems: 0, postsTracked: config.posts_tracked, commentsTracked: config.comments_tracked, likesTracked: config.likes_tracked };
  }

  // Get API keys
  const { data: apiKeys } = await supabase
    .from("user_api_keys")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!apiKeys) {
    console.log(`User ${userId}: API keys not configured, skipping`);
    return { newItems: 0, postsTracked: config.posts_tracked, commentsTracked: config.comments_tracked, likesTracked: config.likes_tracked };
  }

  let newItems = 0;
  let commentsTracked = config.comments_tracked || 0;
  let likesTracked = config.likes_tracked || 0;

  // UNIFIED DEDUPLICATION: Pre-fetch existing posts from instagram_synced_post_content
  // This is the single source of truth for what's been captured (shared with instagram-sync)
  const { data: existingStoredPosts } = await supabase
    .from("instagram_synced_post_content")
    .select("instagram_post_id")
    .eq("user_id", userId);

  const existingPostIds = new Set(existingStoredPosts?.map((p: any) => p.instagram_post_id) || []);
  console.log(`[Dedup] User ${userId} has ${existingPostIds.size} posts already stored`);

  // Fetch recent posts
  if (config.monitor_new_posts || config.monitor_comments || config.monitor_likes) {
    // Get Instagram User ID first
    const igUserId = await getInstagramUserId(connectedAccountId);
    console.log(`Instagram User ID for user ${userId}: ${igUserId}`);
    
    const posts = await fetchInstagramPosts(connectedAccountId, igUserId, 10);

    // Batch processing - limit posts per poll to avoid timeouts
    const postsToProcess = posts.slice(0, BATCH_SIZE);
    console.log(`Processing ${postsToProcess.length} of ${posts.length} posts (batch limit: ${BATCH_SIZE})`);

    for (let i = 0; i < postsToProcess.length; i++) {
      const post = postsToProcess[i];
      
      // UNIFIED DEDUPLICATION CHECK: Use instagram_synced_post_content as single source of truth
      const alreadyStored = existingPostIds.has(post.id);

      if (!alreadyStored && config.monitor_new_posts) {
        const mediaUrl = post.media_url || post.thumbnail_url || "";
        
        // STEP 1: Store post locally for reliable 1:1 retrieval (also serves as deduplication)
        await storePostLocally(supabase, userId, post, mediaUrl);

        // STEP 2: Create memory via LIAM API for semantic search
        const memoryContent = formatPostAsMemory(post);
        const success = await createMemory(apiKeys, memoryContent);
        
        if (!success) {
          console.log(`[Memory] LIAM API failed for post ${post.id} - post is still stored locally`);
        }

        // STEP 3: Also insert into instagram_processed_engagement for backward compatibility
        await supabase
          .from("instagram_processed_engagement")
          .upsert({
            user_id: userId,
            engagement_type: "post",
            instagram_item_id: post.id,
          }, { onConflict: "user_id,instagram_item_id,engagement_type" })
          .then(({ error }: any) => {
            if (error) console.log(`[Engagement] Insert note: ${error.message}`);
          });
        
        newItems++;

        // Rate limiting delay
        if (i < postsToProcess.length - 1) {
          console.log(`[RateLimit] Waiting ${MEMORY_CREATION_DELAY_MS}ms before next post...`);
          await delay(MEMORY_CREATION_DELAY_MS);
        }
      }

      // Check for new comments
      if (config.monitor_comments) {
        const comments = await fetchPostComments(connectedAccountId, post.id);
        
        for (const comment of comments) {
          const { data: existingComment } = await supabase
            .from("instagram_processed_engagement")
            .select("id")
            .eq("user_id", userId)
            .eq("engagement_type", "comment")
            .eq("instagram_item_id", comment.id)
            .maybeSingle();

          if (!existingComment) {
            const commenter = comment.username || comment.from?.username || "someone";
            const memoryContent = [
              `💬 New comment on Instagram`,
              `@${commenter} commented: "${comment.text}"`,
              post.caption ? `On post: "${post.caption.substring(0, 100)}..."` : "",
              post.permalink ? `[link:${post.permalink}]` : "",
            ].filter(Boolean).join("\n");

            const success = await createMemory(apiKeys, memoryContent);
            if (success) {
              await supabase
                .from("instagram_processed_engagement")
                .insert({
                  user_id: userId,
                  engagement_type: "comment",
                  instagram_item_id: comment.id,
                });
              commentsTracked++;
              newItems++;
            }
          }
        }
      }
    }
  }

  // FIX: Calculate stats from actual data instead of incrementing (prevents silent failures)
  const { count: actualPostsCount, error: countError } = await supabase
    .from("instagram_synced_post_content")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (countError) {
    console.error(`[Stats] Error counting posts for user ${userId}:`, countError);
  }

  const postsTracked = actualPostsCount || 0;

  // Update stats with error handling
  const { error: updateError } = await supabase
    .from("instagram_automation_config")
    .update({
      last_polled_at: new Date().toISOString(),
      posts_tracked: postsTracked,
      comments_tracked: commentsTracked,
      likes_tracked: likesTracked,
    })
    .eq("user_id", userId);

  if (updateError) {
    console.error(`[Stats] Failed to update config for user ${userId}:`, updateError);
  } else {
    console.log(`[Stats] Updated for user ${userId}: posts=${postsTracked}, comments=${commentsTracked}, likes=${likesTracked}`);
  }

  return { newItems, postsTracked, commentsTracked, likesTracked };
}

// === MAIN HANDLER ===

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Parse body first to check action
    const body = await req.json();
    const { action } = body;

    // Handle cron-poll action (no user auth required, uses cron secret OR internal trigger)
    if (action === "cron-poll") {
      const cronSecret = req.headers.get("x-cron-secret");
      const cronTrigger = req.headers.get("x-cron-trigger");
      
      // Accept either valid cron secret OR internal trigger header (dual-auth pattern)
      const isValidSecret = CRON_SECRET && cronSecret === CRON_SECRET;
      const isInternalTrigger = cronTrigger === "supabase-internal";
      
      if (!isValidSecret && !isInternalTrigger) {
        console.error("Cron poll: Invalid or missing cron secret/trigger");
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Cron poll: Starting automatic Instagram check for all active users");

      // Get all active automation configs
      const { data: activeConfigs, error: configError } = await supabase
        .from("instagram_automation_config")
        .select("*")
        .eq("is_active", true);

      if (configError) {
        console.error("Cron poll: Error fetching configs:", configError);
        return new Response(JSON.stringify({ error: "Failed to fetch configs" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!activeConfigs || activeConfigs.length === 0) {
        console.log("Cron poll: No active users to process");
        return new Response(JSON.stringify({ success: true, processed: 0, message: "No active users" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Cron poll: Processing ${activeConfigs.length} active user(s)`);

      let totalProcessed = 0;
      let totalNewItems = 0;
      const errors: string[] = [];

      for (const config of activeConfigs) {
        try {
          console.log(`Cron poll: Processing user ${config.user_id}`);
          const result = await processUserInstagram(supabase, config.user_id, config);
          totalProcessed++;
          totalNewItems += result.newItems;
          console.log(`Cron poll: User ${config.user_id} - ${result.newItems} new items`);
        } catch (error) {
          console.error(`Cron poll: Error processing user ${config.user_id}:`, error);
          errors.push(`User ${config.user_id}: ${error}`);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        processed: totalProcessed,
        newItems: totalNewItems,
        errors: errors.length > 0 ? errors : undefined,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For other actions, require user authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // Handle different actions
    if (action === "activate") {
      // Set config to active
      await supabase
        .from("instagram_automation_config")
        .update({ is_active: true })
        .eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "deactivate") {
      await supabase
        .from("instagram_automation_config")
        .update({ is_active: false })
        .eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "manual-poll") {
      // Get user's config
      const { data: config } = await supabase
        .from("instagram_automation_config")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (!config) {
        return new Response(JSON.stringify({ error: "No automation config found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const result = await processUserInstagram(supabase, userId, config);

        return new Response(JSON.stringify({
          success: true,
          newItems: result.newItems,
          postsTracked: result.postsTracked,
          commentsTracked: result.commentsTracked,
          likesTracked: result.likesTracked,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (pollError: any) {
        if (pollError?.code === 'CONNECTION_EXPIRED' || pollError?.message === 'CONNECTION_EXPIRED') {
          return new Response(JSON.stringify({ error: "CONNECTION_EXPIRED", message: "Your Instagram connection has expired. Please reconnect." }), {
            status: 410,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw pollError;
      }
    }

    // Unknown action
    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Instagram automation poll error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
