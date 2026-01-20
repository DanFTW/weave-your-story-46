import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface YouTubeVideo {
  id: string;
  title: string;
  channelTitle?: string;
  description?: string;
  publishedAt: string;
  thumbnailUrl?: string;
  viewCount?: number;
  likeCount?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const composioApiKey = Deno.env.get("COMPOSIO_API_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action } = await req.json();
    console.log(`YouTube sync action: ${action} for user: ${user.id}`);

    // Get user's YouTube connection
    const { data: integration, error: integrationError } = await supabase
      .from("user_integrations")
      .select("*")
      .eq("user_id", user.id)
      .eq("integration_id", "youtube")
      .eq("status", "connected")
      .maybeSingle();

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ error: "YouTube not connected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const connectionId = integration.composio_connection_id;

    if (action === "list-videos") {
      // Fetch liked videos from YouTube via Composio
      const videos = await fetchLikedVideos(composioApiKey, connectionId);
      
      return new Response(
        JSON.stringify({ videos }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "sync") {
      // Get user's sync config
      const { data: config } = await supabase
        .from("youtube_sync_config")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!config) {
        return new Response(
          JSON.stringify({ error: "Sync not configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get already synced video IDs
      const { data: syncedPosts } = await supabase
        .from("youtube_synced_posts")
        .select("youtube_video_id")
        .eq("user_id", user.id);

      const syncedVideoIds = new Set(syncedPosts?.map(p => p.youtube_video_id) || []);

      // Fetch videos based on config
      let allVideos: YouTubeVideo[] = [];

      if (config.sync_liked_videos) {
        const likedVideos = await fetchLikedVideos(composioApiKey, connectionId);
        allVideos = [...allVideos, ...likedVideos];
      }

      // Filter out already synced videos
      const newVideos = allVideos.filter(v => !syncedVideoIds.has(v.id));
      console.log(`Found ${newVideos.length} new videos to sync`);

      // Get user API keys for memory creation
      const { data: apiKeys } = await supabase
        .from("user_api_keys")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      let memoriesCreated = 0;

      if (apiKeys && newVideos.length > 0) {
        // Create memories for new videos
        for (const video of newVideos.slice(0, 20)) { // Limit to 20 per sync
          try {
            const memoryContent = formatVideoAsMemory(video);
            const memoryId = await createMemory(apiKeys, memoryContent, "YOUTUBE");

            if (memoryId) {
              // Record synced video
              await supabase.from("youtube_synced_posts").insert({
                user_id: user.id,
                youtube_video_id: video.id,
                memory_id: memoryId,
              });
              memoriesCreated++;
            }
          } catch (error) {
            console.error(`Error creating memory for video ${video.id}:`, error);
          }
        }
      }

      // Update sync config
      await supabase
        .from("youtube_sync_config")
        .update({
          last_sync_at: new Date().toISOString(),
          videos_synced_count: (config.videos_synced_count || 0) + newVideos.length,
          memories_created_count: (config.memories_created_count || 0) + memoriesCreated,
          last_synced_video_id: newVideos[0]?.id || config.last_synced_video_id,
        })
        .eq("user_id", user.id);

      return new Response(
        JSON.stringify({
          success: true,
          videosSynced: newVideos.length,
          memoriesCreated,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "reset-sync") {
      // Reset sync state but keep synced posts for deduplication
      await supabase
        .from("youtube_sync_config")
        .update({
          last_sync_at: null,
          last_synced_video_id: null,
          videos_synced_count: 0,
          memories_created_count: 0,
        })
        .eq("user_id", user.id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("YouTube sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function fetchLikedVideos(apiKey: string, connectionId: string): Promise<YouTubeVideo[]> {
  try {
    // Use Composio to execute YouTube API action
    const response = await fetch("https://backend.composio.dev/api/v3/actions/YOUTUBE_LIST_VIDEOS/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        connected_account_id: connectionId,
        input: {
          part: "snippet,statistics",
          myRating: "like",
          maxResults: 20,
        },
      }),
    });

    if (!response.ok) {
      console.error("Composio YouTube API error:", await response.text());
      return [];
    }

    const data = await response.json();
    console.log("YouTube API response:", JSON.stringify(data).slice(0, 500));

    // Parse response - handle different response structures
    const items = data?.data?.items || data?.response?.data?.items || data?.items || [];
    
    return items.map((item: any) => ({
      id: item.id || item.snippet?.resourceId?.videoId,
      title: item.snippet?.title || "Untitled",
      channelTitle: item.snippet?.channelTitle,
      description: item.snippet?.description,
      publishedAt: item.snippet?.publishedAt || new Date().toISOString(),
      thumbnailUrl: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url,
      viewCount: parseInt(item.statistics?.viewCount) || undefined,
      likeCount: parseInt(item.statistics?.likeCount) || undefined,
    }));
  } catch (error) {
    console.error("Error fetching liked videos:", error);
    return [];
  }
}

function formatVideoAsMemory(video: YouTubeVideo): string {
  let content = `Watched: ${video.title}`;
  
  if (video.channelTitle) {
    content += ` by ${video.channelTitle}`;
  }
  
  if (video.description) {
    const shortDesc = video.description.slice(0, 200);
    content += `\n\n${shortDesc}${video.description.length > 200 ? '...' : ''}`;
  }

  return content;
}

async function createMemory(
  apiKeys: { user_key: string; private_key: string; api_key: string },
  content: string,
  tag: string
): Promise<string | null> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);

    // Import the private key for signing
    const privateKeyDer = Uint8Array.from(atob(apiKeys.private_key), c => c.charCodeAt(0));
    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      privateKeyDer,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );

    // Sign the content
    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      privateKey,
      data
    );

    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

    const response = await fetch("https://web.askbuddy.ai/devspacexdb/api/memory/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-key": apiKeys.user_key,
        "x-signature": signatureBase64,
      },
      body: JSON.stringify({
        userKey: apiKeys.user_key,
        content,
        tags: [tag],
        source: "youtube",
      }),
    });

    if (!response.ok) {
      console.error("Memory creation failed:", await response.text());
      return null;
    }

    const result = await response.json();
    return result.id || result.memoryId || null;
  } catch (error) {
    console.error("Error creating memory:", error);
    return null;
  }
}
