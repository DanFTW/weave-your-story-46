import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COMPOSIO_API_KEY = Deno.env.get('COMPOSIO_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface InstagramPost {
  id: string;
  caption?: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  mediaUrl?: string;
  permalinkUrl?: string;
  timestamp: string;
  username?: string;
  likesCount?: number;
  commentsCount?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the user's Instagram connection
    const { data: integration, error: intError } = await supabase
      .from('user_integrations')
      .select('composio_connection_id')
      .eq('user_id', user.id)
      .eq('integration_id', 'instagram')
      .eq('status', 'connected')
      .single();

    if (intError || !integration?.composio_connection_id) {
      console.error('Integration error:', intError);
      return new Response(
        JSON.stringify({ error: 'Instagram not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const connectionId = integration.composio_connection_id;
    const { action, limit = 25 } = await req.json();

    console.log(`Instagram sync action: ${action}, user: ${user.id}, connection: ${connectionId}`);

    switch (action) {
      case 'list-posts': {
        // First get the Instagram User ID
        const igUserId = await getInstagramUserId(connectionId);
        if (!igUserId) {
          return new Response(
            JSON.stringify({ error: 'Failed to get Instagram user ID. Make sure you have a Business or Creator account.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const posts = await fetchInstagramPosts(connectionId, igUserId, limit);
        return new Response(JSON.stringify({ posts }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'sync': {
        const result = await syncInstagramContent(supabase, user.id, connectionId);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Instagram sync error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Get Instagram User ID (required for media API calls)
async function getInstagramUserId(connectionId: string): Promise<string | null> {
  try {
    console.log('Fetching Instagram user ID...');
    
    const response = await fetch('https://backend.composio.dev/api/v3/tools/execute/INSTAGRAM_GET_USER_INFO', {
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
    console.log('Instagram user info response status:', response.status);
    console.log('Instagram user info response:', responseText.slice(0, 500));

    if (!response.ok) {
      console.error('Composio API error getting user info:', response.status, responseText);
      return null;
    }

    const data = JSON.parse(responseText);
    
    // Parse the response to get the user ID
    // Response structure may vary, try multiple paths
    const responseData = data.data || data;
    const userId = responseData?.id || 
                   responseData?.response_data?.id || 
                   responseData?.user?.id ||
                   responseData?.ig_user_id;
    
    console.log('Found Instagram user ID:', userId);
    return userId || null;
  } catch (error) {
    console.error('Error getting Instagram user ID:', error);
    return null;
  }
}

async function fetchInstagramPosts(connectionId: string, igUserId: string, limit: number): Promise<InstagramPost[]> {
  try {
    console.log(`Fetching Instagram posts for user ${igUserId}, limit: ${limit}`);
    
    const response = await fetch('https://backend.composio.dev/api/v3/tools/execute/INSTAGRAM_GET_IG_USER_MEDIA', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': COMPOSIO_API_KEY!,
      },
      body: JSON.stringify({
        connected_account_id: connectionId,
        arguments: { 
          ig_user_id: igUserId,  // Required parameter
          fields: 'id,caption,media_type,media_url,permalink,timestamp,username,like_count,comments_count',
          limit,
        },
      }),
    });

    const responseText = await response.text();
    console.log('Instagram posts response status:', response.status);
    console.log('Instagram posts response:', responseText.slice(0, 500));

    if (!response.ok) {
      console.error('Composio API error:', responseText);
      throw new Error('Failed to fetch Instagram posts');
    }

    const data = JSON.parse(responseText);
    
    // Parse the response - Composio returns data in a nested structure
    const responseData = data.data || data;
    const mediaData = responseData?.response_data?.data || 
                      responseData?.data || 
                      responseData?.media?.data ||
                      [];
    
    console.log(`Found ${Array.isArray(mediaData) ? mediaData.length : 0} Instagram posts`);
    
    if (!Array.isArray(mediaData)) {
      console.log('Media data is not an array:', typeof mediaData);
      return [];
    }
    
    return mediaData.map((item: any) => ({
      id: item.id,
      caption: item.caption,
      mediaType: item.media_type,
      mediaUrl: item.media_url,
      permalinkUrl: item.permalink,
      timestamp: item.timestamp,
      username: item.username,
      likesCount: item.like_count,
      commentsCount: item.comments_count,
    }));
  } catch (error) {
    console.error('Error fetching posts:', error);
    return [];
  }
}

async function syncInstagramContent(
  supabase: any,
  userId: string,
  connectionId: string
): Promise<{ success: boolean; postsSynced: number; commentsSynced: number; memoriesCreated: number; error?: string }> {
  try {
    // First get the Instagram User ID
    const igUserId = await getInstagramUserId(connectionId);
    if (!igUserId) {
      return {
        success: false,
        postsSynced: 0,
        commentsSynced: 0,
        memoriesCreated: 0,
        error: 'Failed to get Instagram user ID. Make sure you have a Business or Creator account.',
      };
    }

    // Get user's sync config
    const { data: config } = await supabase
      .from('instagram_sync_config')
      .select('*')
      .eq('user_id', userId)
      .single();

    const syncPosts = config?.sync_posts ?? true;
    const lastSyncedPostId = config?.last_synced_post_id;

    // Fetch posts
    const posts = await fetchInstagramPosts(connectionId, igUserId, 50);
    
    if (posts.length === 0) {
      return { success: true, postsSynced: 0, commentsSynced: 0, memoriesCreated: 0 };
    }

    // Get user's API keys for LIAM
    const { data: apiKeys } = await supabase
      .from('user_api_keys')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!apiKeys) {
      console.error('No API keys found for user');
      return {
        success: false,
        postsSynced: 0,
        commentsSynced: 0,
        memoriesCreated: 0,
        error: 'LIAM API keys not configured. Please configure your API keys first.',
      };
    }

    let postsSynced = 0;
    let memoriesCreated = 0;
    let newLastSyncedPostId = lastSyncedPostId;

    // Find new posts (those after lastSyncedPostId)
    let newPosts = posts;
    if (lastSyncedPostId) {
      const lastIndex = posts.findIndex(p => p.id === lastSyncedPostId);
      if (lastIndex > 0) {
        newPosts = posts.slice(0, lastIndex);
      } else if (lastIndex === 0) {
        newPosts = [];
      }
    }

    console.log(`Found ${newPosts.length} new posts to sync`);

    // Create memories for each new post
    for (const post of newPosts) {
      if (syncPosts && post.caption) {
        const memoryContent = formatPostAsMemory(post);
        const success = await createMemory(apiKeys, memoryContent);
        if (success) {
          memoriesCreated++;
          postsSynced++;
        }
      }

      // Update the newest synced post ID
      if (!newLastSyncedPostId || post.timestamp > (posts.find(p => p.id === newLastSyncedPostId)?.timestamp || '')) {
        newLastSyncedPostId = post.id;
      }
    }

    // Update sync config
    const updateData = {
      user_id: userId,
      last_sync_at: new Date().toISOString(),
      last_synced_post_id: newLastSyncedPostId || posts[0]?.id,
      posts_synced_count: (config?.posts_synced_count || 0) + postsSynced,
      memories_created_count: (config?.memories_created_count || 0) + memoriesCreated,
      updated_at: new Date().toISOString(),
    };

    if (config?.id) {
      await supabase
        .from('instagram_sync_config')
        .update(updateData)
        .eq('id', config.id);
    } else {
      await supabase
        .from('instagram_sync_config')
        .insert(updateData);
    }

    return {
      success: true,
      postsSynced,
      commentsSynced: 0,
      memoriesCreated,
    };
  } catch (error) {
    console.error('Sync error:', error);
    return {
      success: false,
      postsSynced: 0,
      commentsSynced: 0,
      memoriesCreated: 0,
      error: error instanceof Error ? error.message : 'Sync failed',
    };
  }
}

function formatPostAsMemory(post: InstagramPost): string {
  const date = post.timestamp ? new Date(post.timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) : 'Unknown date';

  let memory = `Instagram Post\nPosted on ${date}`;
  
  if (post.username) {
    memory += ` by @${post.username}`;
  }
  
  memory += '\n\n';
  
  if (post.caption) {
    memory += post.caption;
  }
  
  if (post.likesCount !== undefined || post.commentsCount !== undefined) {
    const engagement = [];
    if (post.likesCount !== undefined) engagement.push(`${post.likesCount} likes`);
    if (post.commentsCount !== undefined) engagement.push(`${post.commentsCount} comments`);
    memory += `\n\nEngagement: ${engagement.join(', ')}`;
  }

  return memory;
}

async function createMemory(apiKeys: any, content: string): Promise<boolean> {
  try {
    // Import the private key for signing
    const privateKeyPem = apiKeys.private_key;
    const privateKey = await importPrivateKey(privateKeyPem);
    
    // Create the request body
    const requestBody = {
      content,
      tag: 'INSTAGRAM',
    };

    // Sign the request
    const signature = await signRequest(privateKey, requestBody);

    // Make request to LIAM API
    const response = await fetch('https://api.lfrng.com/v1/memory/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apiKey': apiKeys.api_key,
        'signature': signature,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LIAM API error:', response.status, errorText);
      return false;
    }

    console.log('Memory created successfully');
    return true;
  } catch (error) {
    console.error('Create memory error:', error);
    return false;
  }
}

// Crypto utilities for LIAM API authentication
async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  // Remove PEM headers and decode
  const pemContents = pemKey
    .replace(/-----BEGIN EC PRIVATE KEY-----/, '')
    .replace(/-----END EC PRIVATE KEY-----/, '')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  // Try PKCS8 first, then raw EC
  try {
    return await crypto.subtle.importKey(
      'pkcs8',
      binaryDer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
  } catch {
    // Try as SEC1 format (raw EC)
    return await crypto.subtle.importKey(
      'raw',
      binaryDer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
  }
}

async function signRequest(privateKey: CryptoKey, body: object): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(body));
  
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    data
  );
  
  // Convert to base64
  const signatureArray = new Uint8Array(signature);
  let binary = '';
  for (let i = 0; i < signatureArray.length; i++) {
    binary += String.fromCharCode(signatureArray[i]);
  }
  return btoa(binary);
}
