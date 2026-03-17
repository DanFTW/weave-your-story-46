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

interface YouTubeVideo {
  id: string;
  title: string;
  channelTitle?: string;
  description?: string;
  publishedAt: string;
  thumbnailUrl?: string;
  videoUrl?: string;
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

    // Get user's YouTube integration
    const { data: integration, error: intError } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('integration_id', 'youtube')
      .eq('status', 'connected')
      .maybeSingle();

    if (intError || !integration) {
      console.log('YouTube integration not found or not connected for user:', user.id);
      return new Response(JSON.stringify({ error: 'YouTube not connected' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, limit = 20 } = await req.json();
    console.log(`YouTube sync action: ${action} for user: ${user.id}`);

    switch (action) {
      case 'list-videos': {
        const videos = await fetchLikedVideos(integration.composio_connection_id, limit);
        return new Response(JSON.stringify({ videos }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'sync': {
        const result = await syncYouTubeContent(supabase, user.id, integration.composio_connection_id);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'reset-sync': {
        // Delete all synced videos and reset config
        await supabase
          .from('youtube_synced_posts')
          .delete()
          .eq('user_id', user.id);

        await supabase
          .from('youtube_sync_config')
          .update({
            last_sync_at: null,
            last_synced_video_id: null,
            videos_synced_count: 0,
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
    console.error('YouTube sync error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Step 1: Get authenticated user's YouTube channel ID
async function getYouTubeChannelId(connectionId: string): Promise<string | null> {
  try {
    console.log('Fetching YouTube channel ID with YOUTUBE_GET_CHANNEL_STATISTICS (mine: true)...');
    
    const response = await fetch('https://backend.composio.dev/api/v3/tools/execute/YOUTUBE_GET_CHANNEL_STATISTICS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': COMPOSIO_API_KEY!,
      },
      body: JSON.stringify({
        connected_account_id: connectionId,
        arguments: {
          mine: true,
          part: 'id,snippet',
        },
      }),
    });

    const responseText = await response.text();
    console.log('Channel stats response status:', response.status);
    console.log('Channel stats response (first 2000 chars):', responseText.slice(0, 2000));

    if (!response.ok) {
      console.error('Failed to get channel ID:', responseText);
      return null;
    }

    const data = JSON.parse(responseText);
    const responseData = data?.data || data;
    
    // Look for channel ID in various response structures
    const possiblePaths = [
      responseData?.response_data?.items?.[0]?.id,
      responseData?.response_data?.data?.items?.[0]?.id,
      responseData?.items?.[0]?.id,
      responseData?.data?.items?.[0]?.id,
      responseData?.result?.items?.[0]?.id,
    ];

    for (const channelId of possiblePaths) {
      if (channelId && typeof channelId === 'string') {
        console.log('Found YouTube channel ID:', channelId);
        return channelId;
      }
    }

    console.log('Could not extract channel ID from response');
    return null;
  } catch (error) {
    console.error('Error getting YouTube channel ID:', error);
    return null;
  }
}

// Step 2: Fetch liked videos using the "LL" (Liked Videos) playlist
async function fetchLikedVideos(connectionId: string, limit: number): Promise<YouTubeVideo[]> {
  try {
    console.log('Fetching liked videos via YOUTUBE_LIST_PLAYLIST_ITEMS with playlistId: LL...');
    
    const response = await fetch('https://backend.composio.dev/api/v3/tools/execute/YOUTUBE_LIST_PLAYLIST_ITEMS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': COMPOSIO_API_KEY!,
      },
      body: JSON.stringify({
        connected_account_id: connectionId,
        arguments: {
          playlistId: 'LL',
          part: 'snippet,contentDetails',
          maxResults: Math.min(limit, 50),
        },
      }),
    });

    const responseText = await response.text();
    console.log('Playlist items response status:', response.status);
    console.log('Playlist items response (first 3000 chars):', responseText.slice(0, 3000));

    if (!response.ok) {
      console.error('Failed to fetch liked videos playlist:', responseText);
      return [];
    }

    const data = JSON.parse(responseText);
    return parsePlaylistItemsResponse(data);
  } catch (error) {
    console.error('Error fetching liked videos:', error);
    return [];
  }
}

// Parse playlist items response to extract videos
function parsePlaylistItemsResponse(data: any): YouTubeVideo[] {
  const videos: YouTubeVideo[] = [];
  
  console.log('Parsing playlist items response, top-level keys:', Object.keys(data || {}));
  
  const responseData = data?.data || data;
  
  let items: any[] = [];
  const possiblePaths = [
    responseData?.response_data?.items,
    responseData?.response_data?.data?.items,
    responseData?.items,
    responseData?.data?.items,
    responseData?.result?.items,
  ];

  for (const path of possiblePaths) {
    if (Array.isArray(path) && path.length > 0) {
      items = path;
      console.log('Found playlist items array, count:', items.length);
      break;
    }
  }

  if (items.length === 0) {
    console.log('No playlist items found in response');
    return [];
  }

  console.log('First playlist item sample:', JSON.stringify(items[0])?.slice(0, 800));

  for (const item of items) {
    const snippet = item.snippet || {};
    const contentDetails = item.contentDetails || {};
    
    // Extract video ID from resourceId or contentDetails
    const videoId = snippet?.resourceId?.videoId || contentDetails?.videoId;
    
    if (!videoId) {
      console.log('Playlist item without video ID, snippet keys:', Object.keys(snippet));
      continue;
    }

    videos.push({
      id: videoId,
      title: snippet.title || 'Untitled Video',
      channelTitle: snippet.videoOwnerChannelTitle || snippet.channelTitle,
      description: snippet.description,
      publishedAt: snippet.publishedAt || contentDetails?.videoPublishedAt || new Date().toISOString(),
      thumbnailUrl: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url,
      videoUrl: `https://youtube.com/watch?v=${videoId}`,
    });
  }

  console.log('Parsed videos from playlist items count:', videos.length);
  return videos;
}

// Fetch subscriptions using YOUTUBE_LIST_USER_SUBSCRIPTIONS
async function fetchSubscriptions(connectionId: string, limit: number): Promise<YouTubeVideo[]> {
  try {
    console.log('Fetching subscriptions with YOUTUBE_LIST_USER_SUBSCRIPTIONS...');
    
    const response = await fetch('https://backend.composio.dev/api/v3/tools/execute/YOUTUBE_LIST_USER_SUBSCRIPTIONS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': COMPOSIO_API_KEY!,
      },
      body: JSON.stringify({
        connected_account_id: connectionId,
        arguments: {
          part: 'snippet,contentDetails',
          mine: true,
          maxResults: Math.min(limit, 50),
        },
      }),
    });

    const responseText = await response.text();
    console.log('Subscriptions response status:', response.status);
    console.log('Subscriptions response (first 2000 chars):', responseText.slice(0, 2000));

    if (!response.ok) {
      console.error('Failed to fetch subscriptions:', responseText);
      return [];
    }

    const data = JSON.parse(responseText);
    return parseSubscriptionsResponse(data);
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return [];
  }
}

// Parse subscriptions response
function parseSubscriptionsResponse(data: any): YouTubeVideo[] {
  const videos: YouTubeVideo[] = [];
  
  const responseData = data?.data || data;
  
  let items: any[] = [];
  const possiblePaths = [
    responseData?.response_data?.items,
    responseData?.response_data?.data?.items,
    responseData?.items,
    responseData?.data?.items,
  ];

  for (const path of possiblePaths) {
    if (Array.isArray(path) && path.length > 0) {
      items = path;
      break;
    }
  }

  for (const item of items) {
    const snippet = item.snippet || {};
    const channelId = snippet.resourceId?.channelId || item.id;
    
    if (!channelId) continue;

    videos.push({
      id: `sub_${channelId}`,
      title: `Subscribed to: ${snippet.title || 'Unknown Channel'}`,
      channelTitle: snippet.title,
      description: snippet.description,
      publishedAt: snippet.publishedAt || new Date().toISOString(),
      thumbnailUrl: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url,
      videoUrl: `https://youtube.com/channel/${channelId}`,
    });
  }

  return videos;
}

async function syncYouTubeContent(
  supabase: any,
  userId: string,
  connectionId: string
): Promise<{ success: boolean; videosSynced: number; memoriesCreated: number; error?: string }> {
  try {
    console.log('Starting YouTube sync for user:', userId);
    
    // Get sync config
    const { data: config } = await supabase
      .from('youtube_sync_config')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    console.log('Sync config:', JSON.stringify(config));

    // Fetch content based on config
    let allVideos: YouTubeVideo[] = [];

    // Default to syncing liked videos if no config or sync_liked_videos is true
    if (!config || config.sync_liked_videos !== false) {
      console.log('Fetching liked videos via channel activities...');
      const likedVideos = await fetchLikedVideos(connectionId, 25);
      console.log('Fetched videos from activities count:', likedVideos.length);
      allVideos = [...allVideos, ...likedVideos];
    }

    // Fetch subscriptions if enabled
    if (config?.sync_subscriptions) {
      console.log('Fetching subscriptions...');
      const subscriptions = await fetchSubscriptions(connectionId, 25);
      console.log('Fetched subscriptions count:', subscriptions.length);
      allVideos = [...allVideos, ...subscriptions];
    }

    if (allVideos.length === 0) {
      console.log('No videos found to sync');
      return { success: true, videosSynced: 0, memoriesCreated: 0 };
    }

    // Get user's API keys for LIAM
    const { data: apiKeys } = await supabase
      .from('user_api_keys')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!apiKeys) {
      console.error('API keys not configured for user');
      return { success: false, videosSynced: 0, memoriesCreated: 0, error: 'API keys not configured' };
    }

    // Get already synced video IDs
    const { data: syncedPosts } = await supabase
      .from('youtube_synced_posts')
      .select('youtube_video_id')
      .eq('user_id', userId);

    const syncedIds = new Set((syncedPosts || []).map((p: { youtube_video_id: string }) => p.youtube_video_id));
    console.log('Already synced video IDs count:', syncedIds.size);

    // Filter out already synced videos
    const videosToSync = allVideos.filter(video => !syncedIds.has(video.id));
    console.log('Videos to sync after filtering:', videosToSync.length);

    let memoriesCreated = 0;

    for (const video of videosToSync.slice(0, 20)) { // Limit to 20 per sync
      const memory = formatVideoAsMemory(video);
      console.log('Creating memory for video:', video.id, 'content preview:', memory.slice(0, 100));
      
      const success = await createMemory(apiKeys, memory);
      
      if (success) {
        // Record synced video
        await supabase
          .from('youtube_synced_posts')
          .insert({
            user_id: userId,
            youtube_video_id: video.id,
            video_title: video.title || null,
            video_category: video.id.startsWith('sub_') ? 'Subscription' : 'Liked Video',
          });
        memoriesCreated++;
        console.log('Memory created successfully for video:', video.id);
      } else {
        console.error('Failed to create memory for video:', video.id);
      }
    }

    // Update sync config
    await supabase
      .from('youtube_sync_config')
      .upsert({
        user_id: userId,
        last_sync_at: new Date().toISOString(),
        last_synced_video_id: videosToSync[0]?.id,
        videos_synced_count: (config?.videos_synced_count || 0) + videosToSync.length,
        memories_created_count: (config?.memories_created_count || 0) + memoriesCreated,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    console.log('Sync complete. Videos synced:', videosToSync.length, 'Memories created:', memoriesCreated);

    return {
      success: true,
      videosSynced: videosToSync.length,
      memoriesCreated,
    };
  } catch (error) {
    console.error('Sync error:', error);
    return { 
      success: false, 
      videosSynced: 0, 
      memoriesCreated: 0, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

function formatVideoAsMemory(video: YouTubeVideo): string {
  const date = new Date(video.publishedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const isSubscription = video.id.startsWith('sub_');
  const label = isSubscription ? 'YouTube Subscription' : 'YouTube Liked Video';
  const action = isSubscription ? 'Subscribed on' : 'Liked on';

  let memory = `${label}\n${action} ${date}`;
  
  memory += `\n\n${video.title}`;
  
  if (video.channelTitle) {
    memory += `\nby ${video.channelTitle}`;
  }
  
  if (video.description) {
    const shortDesc = video.description.slice(0, 200).trim();
    if (shortDesc) {
      memory += `\n\n${shortDesc}${video.description.length > 200 ? '...' : ''}`;
    }
  }

  if (video.videoUrl) {
    memory += `\n\n${video.videoUrl}`;
  }

  return memory;
}

// LIAM API integration with cryptographic signing
async function createMemory(apiKeys: { api_key: string; private_key: string; user_key: string }, memoryContent: string): Promise<boolean> {
  try {
    const requestBody = {
      content: memoryContent,
      userKey: apiKeys.user_key,
      tag: 'YOUTUBE',
    };
    
    const bodyString = JSON.stringify(requestBody);
    console.log('Creating memory with body:', bodyString.slice(0, 200));

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

    console.log('LIAM API success for memory creation');
    return true;
  } catch (error) {
    console.error('Create memory error:', error);
    return false;
  }
}

// Crypto utilities for LIAM API signing (DER format required)
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
