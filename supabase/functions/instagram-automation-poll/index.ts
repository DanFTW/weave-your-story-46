import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const LIAM_API_BASE = "https://web.askbuddy.ai/devspacexdb/api/memory";

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

// === CRYPTO UTILITIES FOR LIAM API ===

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

function toDER(signature: Uint8Array): string {
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

  return btoa(String.fromCharCode(...der));
}

async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  const pemContents = pemKey
    .replace(/-----BEGIN EC PRIVATE KEY-----/g, "")
    .replace(/-----END EC PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  
  return await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

async function signRequest(privateKey: CryptoKey, body: object): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(body));
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    data
  );
  return toDER(new Uint8Array(signature));
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

async function fetchInstagramPosts(connectedAccountId: string, limit = 25): Promise<InstagramPost[]> {
  const response = await fetch("https://backend.composio.dev/api/v2/actions/INSTAGRAM_GET_USER_MEDIA/execute", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": COMPOSIO_API_KEY,
    },
    body: JSON.stringify({
      connectedAccountId,
      input: {},
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch posts: ${response.statusText}`);
  }

  const result = await response.json();
  const posts = result?.response_data?.data || result?.data?.data || [];
  return posts.slice(0, limit);
}

async function fetchPostComments(connectedAccountId: string, postId: string): Promise<InstagramComment[]> {
  const response = await fetch("https://backend.composio.dev/api/v2/actions/INSTAGRAM_GET_IG_MEDIA_COMMENTS/execute", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": COMPOSIO_API_KEY,
    },
    body: JSON.stringify({
      connectedAccountId,
      input: { ig_media_id: postId },
    }),
  });

  if (!response.ok) return [];

  const result = await response.json();
  return result?.response_data?.data || result?.data?.data || [];
}

// === LIAM MEMORY API ===

async function createMemory(apiKeys: any, content: string): Promise<boolean> {
  try {
    const privateKey = await importPrivateKey(apiKeys.private_key);
    const body = { userKey: apiKeys.user_key, data: content };
    const signature = await signRequest(privateKey, body);

    const response = await fetch(`${LIAM_API_BASE}/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKeys.api_key,
        "X-Signature": signature,
      },
      body: JSON.stringify(body),
    });

    return response.ok;
  } catch (error) {
    console.error("Error creating memory:", error);
    return false;
  }
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
  let postsTracked = config.posts_tracked || 0;
  let commentsTracked = config.comments_tracked || 0;
  let likesTracked = config.likes_tracked || 0;

  // Fetch recent posts
  if (config.monitor_new_posts || config.monitor_comments || config.monitor_likes) {
    const posts = await fetchInstagramPosts(connectedAccountId, 10);

    for (const post of posts) {
      // Check if post already processed
      const { data: existingPost } = await supabase
        .from("instagram_processed_engagement")
        .select("id")
        .eq("user_id", userId)
        .eq("engagement_type", "post")
        .eq("instagram_item_id", post.id)
        .maybeSingle();

      if (!existingPost && config.monitor_new_posts) {
        // Create memory for new post
        const mediaUrl = post.media_url || post.thumbnail_url || "";
        const memoryContent = [
          `📸 Instagram Post`,
          post.caption ? `"${post.caption}"` : "",
          post.like_count ? `❤️ ${post.like_count} likes` : "",
          post.comments_count ? `💬 ${post.comments_count} comments` : "",
          mediaUrl ? `[media:${mediaUrl}]` : "",
          post.permalink ? `[link:${post.permalink}]` : "",
        ].filter(Boolean).join("\n");

        const success = await createMemory(apiKeys, memoryContent);
        if (success) {
          await supabase
            .from("instagram_processed_engagement")
            .insert({
              user_id: userId,
              engagement_type: "post",
              instagram_item_id: post.id,
            });
          postsTracked++;
          newItems++;
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

  // Update stats
  await supabase
    .from("instagram_automation_config")
    .update({
      last_polled_at: new Date().toISOString(),
      posts_tracked: postsTracked,
      comments_tracked: commentsTracked,
      likes_tracked: likesTracked,
    })
    .eq("user_id", userId);

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

    // Handle cron-poll action (no user auth required, uses cron secret)
    if (action === "cron-poll") {
      const cronSecret = req.headers.get("x-cron-secret");
      if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
        console.error("Cron poll: Invalid or missing cron secret");
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
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          console.error(`Cron poll: Failed for user ${config.user_id}:`, errorMsg);
          errors.push(`${config.user_id}: ${errorMsg}`);
        }
      }

      console.log(`Cron poll: Completed - ${totalProcessed} users, ${totalNewItems} new items`);

      return new Response(JSON.stringify({ 
        success: true, 
        processed: totalProcessed,
        newItems: totalNewItems,
        errors: errors.length > 0 ? errors : undefined,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For all other actions, require user authentication
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get automation config for this user
    const { data: configData } = await supabase
      .from("instagram_automation_config")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    // Handle actions
    switch (action) {
      case "activate": {
        // Update config to active
        await supabase
          .from("instagram_automation_config")
          .update({ is_active: true, last_polled_at: new Date().toISOString() })
          .eq("user_id", user.id);

        return new Response(JSON.stringify({ success: true, message: "Monitoring activated" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "deactivate": {
        await supabase
          .from("instagram_automation_config")
          .update({ is_active: false })
          .eq("user_id", user.id);

        return new Response(JSON.stringify({ success: true, message: "Monitoring deactivated" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "manual-poll": {
        if (!configData) {
          return new Response(JSON.stringify({ error: "No config found" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const result = await processUserInstagram(supabase, user.id, configData);

        return new Response(JSON.stringify({ success: true, newItems: result.newItems }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "stats": {
        return new Response(JSON.stringify({
          postsTracked: configData?.posts_tracked || 0,
          commentsTracked: configData?.comments_tracked || 0,
          likesTracked: configData?.likes_tracked || 0,
          lastChecked: configData?.last_polled_at,
          isActive: configData?.is_active || false,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("Error in instagram-automation-poll:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
