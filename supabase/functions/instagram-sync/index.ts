import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COMPOSIO_API_KEY = Deno.env.get('COMPOSIO_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const LIAM_API_KEY = Deno.env.get('LIAM_API_KEY');
const LIAM_USER_KEY = Deno.env.get('LIAM_USER_KEY');
const LIAM_PRIVATE_KEY = Deno.env.get('LIAM_PRIVATE_KEY');

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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Not authenticated');
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
      throw new Error('Instagram not connected');
    }

    const connectionId = integration.composio_connection_id;
    const { action, limit = 25 } = await req.json();

    console.log(`Instagram sync action: ${action}, user: ${user.id}`);

    switch (action) {
      case 'list-posts': {
        const posts = await fetchInstagramPosts(connectionId, limit);
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
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Instagram sync error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function fetchInstagramPosts(connectionId: string, limit: number): Promise<InstagramPost[]> {
  try {
    const response = await fetch('https://backend.composio.dev/api/v3/tools/execute/INSTAGRAM_GET_IG_USER_MEDIA', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': COMPOSIO_API_KEY!,
      },
      body: JSON.stringify({
        connected_account_id: connectionId,
        arguments: { 
          fields: 'id,caption,media_type,media_url,permalink,timestamp,username,like_count,comments_count',
          limit,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Composio API error:', errorText);
      throw new Error('Failed to fetch Instagram posts');
    }

    const data = await response.json();
    console.log('Composio response:', JSON.stringify(data, null, 2));

    // Parse the response - Composio returns data in a nested structure
    const mediaData = data?.response_data?.data || data?.data?.data || data?.data || [];
    
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
    // Get user's sync config
    const { data: config } = await supabase
      .from('instagram_sync_config')
      .select('*')
      .eq('user_id', userId)
      .single();

    const syncPosts = config?.sync_posts ?? true;
    const syncComments = config?.sync_comments ?? true;
    const lastSyncedPostId = config?.last_synced_post_id;

    // Fetch posts
    const posts = await fetchInstagramPosts(connectionId, 50);
    
    if (posts.length === 0) {
      return { success: true, postsSynced: 0, commentsSynced: 0, memoriesCreated: 0 };
    }

    let postsSynced = 0;
    let commentsSynced = 0;
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
        const success = await createMemory(memoryContent, 'INSTAGRAM');
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
    await supabase
      .from('instagram_sync_config')
      .upsert({
        user_id: userId,
        last_sync_at: new Date().toISOString(),
        last_synced_post_id: newLastSyncedPostId || posts[0]?.id,
        posts_synced_count: (config?.posts_synced_count || 0) + postsSynced,
        memories_created_count: (config?.memories_created_count || 0) + memoriesCreated,
      }, {
        onConflict: 'user_id',
      });

    return {
      success: true,
      postsSynced,
      commentsSynced,
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

async function createMemory(content: string, tag: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.liam-memory.com/v1/memories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': LIAM_API_KEY!,
        'x-user-key': LIAM_USER_KEY!,
        'x-private-key': LIAM_PRIVATE_KEY!,
      },
      body: JSON.stringify({
        content,
        tags: [tag],
      }),
    });

    if (!response.ok) {
      console.error('Failed to create memory:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error creating memory:', error);
    return false;
  }
}
