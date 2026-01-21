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
  thumbnailUrl?: string;
  permalinkUrl?: string;
  timestamp: string;
  username?: string;
  likesCount?: number;
  commentsCount?: number;
  children?: { id: string; media_type: string; media_url: string }[];
}

interface InstagramComment {
  id: string;
  text: string;
  timestamp: string;
  username?: string;
  from?: { id: string; username: string };
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

    // Create Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Verify user by passing the token directly to getUser()
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized', 
          details: authError?.message || 'Invalid or expired token',
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

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
        // Try to get the Instagram User ID (optional for INSTAGRAM_GET_USER_MEDIA)
        const igUserId = await getInstagramUserId(connectionId);
        console.log(`Instagram User ID for list-posts: ${igUserId}`);
        
        const { posts, error } = await fetchInstagramPosts(connectionId, igUserId, limit);
        
        if (error) {
          console.error('Error listing posts:', error);
          return new Response(
            JSON.stringify({ error, posts: [] }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
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

      case 'reset-sync': {
        // Soft reset: Only reset metadata, preserve deduplication table
        const { error: resetError } = await supabase
          .from('instagram_sync_config')
          .update({
            last_synced_post_id: null,
            last_sync_at: null,
            posts_synced_count: 0,
            memories_created_count: 0,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        if (resetError) {
          console.error('Reset sync error:', resetError);
          return new Response(
            JSON.stringify({ error: 'Failed to reset sync state' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Sync config reset (deduplication preserved) for user:', user.id);
        return new Response(
          JSON.stringify({ success: true, message: 'Sync state reset. Previously synced posts will not be re-synced.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'force-reset-sync': {
        // Force reset: Clear BOTH config AND deduplication table to allow full re-sync
        console.log('Force reset sync for user:', user.id);
        
        // First, clear the deduplication table
        const { error: deleteError } = await supabase
          .from('instagram_synced_posts')
          .delete()
          .eq('user_id', user.id);
        
        if (deleteError) {
          console.error('Error clearing synced posts:', deleteError);
          return new Response(
            JSON.stringify({ error: 'Failed to clear sync history' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Then reset the config
        const { error: resetError } = await supabase
          .from('instagram_sync_config')
          .update({
            last_synced_post_id: null,
            last_sync_at: null,
            posts_synced_count: 0,
            memories_created_count: 0,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        if (resetError) {
          console.error('Reset sync config error:', resetError);
          return new Response(
            JSON.stringify({ error: 'Failed to reset sync state' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Force reset complete - all posts can be re-synced for user:', user.id);
        return new Response(
          JSON.stringify({ success: true, message: 'Full reset complete. All posts will be re-synced as new memories.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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

async function fetchInstagramPosts(connectionId: string, igUserId: string | null, limit: number): Promise<{ posts: InstagramPost[]; error?: string }> {
  try {
    console.log(`Fetching Instagram posts, igUserId: ${igUserId}, limit: ${limit}`);
    
    // Use INSTAGRAM_GET_USER_MEDIA which has ig_user_id as optional
    const response = await fetch('https://backend.composio.dev/api/v3/tools/execute/INSTAGRAM_GET_USER_MEDIA', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': COMPOSIO_API_KEY!,
      },
      body: JSON.stringify({
        connected_account_id: connectionId,
        arguments: { 
          ...(igUserId && { ig_user_id: igUserId }),  // Optional parameter
          limit,
        },
      }),
    });

    const responseText = await response.text();
    console.log('Instagram posts response status:', response.status);
    console.log('Instagram posts response:', responseText.slice(0, 1000));

    if (!response.ok) {
      console.error('Composio API error:', responseText);
      return { posts: [], error: `Failed to fetch Instagram posts: ${response.status}` };
    }

    const data = JSON.parse(responseText);
    
    // Parse the response - handle multiple possible structures
    const responseData = data.data || data;
    
    // Try multiple paths for the media data
    let mediaData = responseData?.response_data?.data ||
                    responseData?.response_data ||
                    responseData?.data ||
                    responseData?.media?.data ||
                    responseData;
    
    // If mediaData is still nested, try to extract
    if (mediaData && typeof mediaData === 'object' && !Array.isArray(mediaData)) {
      mediaData = mediaData.data || mediaData.media || [];
    }
    
    console.log(`Raw media data type: ${typeof mediaData}, isArray: ${Array.isArray(mediaData)}`);
    console.log('Media data sample:', JSON.stringify(mediaData).slice(0, 500));
    
    if (!Array.isArray(mediaData)) {
      console.log('Media data is not an array, attempting to extract from object');
      // Last resort: if it's an object with numeric keys, convert to array
      if (typeof mediaData === 'object' && mediaData !== null) {
        const keys = Object.keys(mediaData);
        if (keys.some(k => !isNaN(Number(k)))) {
          mediaData = Object.values(mediaData);
        } else {
          return { posts: [], error: 'Unexpected response format from Instagram API' };
        }
      } else {
        return { posts: [] };
      }
    }
    
    console.log(`Found ${mediaData.length} Instagram posts`);
    
    const posts = mediaData.map((item: any) => ({
      id: item.id,
      caption: item.caption,
      mediaType: item.media_type || item.mediaType,
      mediaUrl: item.media_url || item.mediaUrl,
      thumbnailUrl: item.thumbnail_url || item.thumbnailUrl,
      permalinkUrl: item.permalink || item.permalinkUrl,
      timestamp: item.timestamp,
      username: item.username,
      likesCount: item.like_count || item.likesCount,
      commentsCount: item.comments_count || item.commentsCount,
      children: item.children?.data || item.children,
    }));
    
    return { posts };
  } catch (error) {
    console.error('Error fetching posts:', error);
    return { posts: [], error: error instanceof Error ? error.message : 'Unknown error fetching posts' };
  }
}

// Fetch comments for a specific Instagram post
async function fetchPostComments(
  connectionId: string,
  mediaId: string
): Promise<{ comments: InstagramComment[]; error?: string }> {
  try {
    console.log(`Fetching comments for post ${mediaId}...`);

    const response = await fetch(
      'https://backend.composio.dev/api/v3/tools/execute/INSTAGRAM_GET_IG_MEDIA_COMMENTS',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': COMPOSIO_API_KEY!,
        },
        body: JSON.stringify({
          connected_account_id: connectionId,
          arguments: { 
            ig_media_id: mediaId,
            limit: 50,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error fetching comments:', response.status, errorText);
      return { comments: [], error: `Failed to fetch comments: ${response.status}` };
    }

    const data = await response.json();
    console.log('Comments response:', JSON.stringify(data).slice(0, 500));

    // Try multiple paths for the comments data
    const responseData = data?.data || data;
    let commentsData =
      responseData?.response_data?.data ||
      responseData?.response_data?.comments?.data ||
      responseData?.data ||
      responseData?.comments?.data ||
      responseData?.comments ||
      responseData;

    if (commentsData && typeof commentsData === 'object' && !Array.isArray(commentsData)) {
      commentsData = commentsData.data || [];
    }

    if (!Array.isArray(commentsData)) {
      console.log('Comments data is not an array');
      return { comments: [] };
    }

    console.log(`Found ${commentsData.length} comments for post ${mediaId}`);
    
    // Map to standardized format
    const comments: InstagramComment[] = commentsData.map((c: any) => ({
      id: c.id,
      text: c.text,
      timestamp: c.timestamp,
      username: c.username,
      from: c.from ? { id: c.from.id, username: c.from.username } : undefined,
    }));
    
    return { comments };
  } catch (error) {
    console.error('Error fetching comments:', error);
    return { comments: [], error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Get the first displayable media URL from a post
function getFirstMediaUrl(post: InstagramPost): string | undefined {
  // For carousel posts, get the first child's media
  if (post.mediaType === 'CAROUSEL_ALBUM' && post.children?.length) {
    return post.children[0].media_url;
  }
  
  // For videos, prefer thumbnail for static display
  if (post.mediaType === 'VIDEO') {
    return post.thumbnailUrl || post.mediaUrl;
  }
  
  // For images, use directly
  return post.mediaUrl;
}

// Format an Instagram comment as a memory string
function formatCommentAsMemory(
  comment: InstagramComment,
  postCaption: string | undefined,
  postMediaUrl?: string
): string {
  const date = comment.timestamp
    ? new Date(comment.timestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Unknown date';

  const commenterName = comment.from?.username || comment.username || 'someone';

  let memory = `Instagram Comment\n`;
  memory += `On ${date}, @${commenterName} commented:\n\n`;
  memory += `"${comment.text}"`;

  // Include post context with full caption
  if (postCaption) {
    memory += `\n\nOn your post: "${postCaption}"`;
  }
  
  // Embed media URL for frontend to display
  if (postMediaUrl) {
    memory += `\n\n[media:${postMediaUrl}]`;
  }

  return memory;
}

async function syncInstagramContent(
  supabase: any,
  userId: string,
  connectionId: string
): Promise<{ success: boolean; postsSynced: number; commentsSynced: number; memoriesCreated: number; skippedDuplicates: number; error?: string }> {
  try {
    // Try to get the Instagram User ID (optional for INSTAGRAM_GET_USER_MEDIA)
    const igUserId = await getInstagramUserId(connectionId);
    console.log(`Instagram User ID for sync: ${igUserId}`);

    // Get user's sync config
    const { data: config } = await supabase
      .from('instagram_sync_config')
      .select('*')
      .eq('user_id', userId)
      .single();

    const syncPosts = config?.sync_posts ?? true;
    const syncComments = config?.sync_comments ?? true;

    console.log(`Sync config - posts: ${syncPosts}, comments: ${syncComments}`);

    // Fetch posts from Instagram
    const { posts, error: fetchError } = await fetchInstagramPosts(connectionId, igUserId, 50);

    if (fetchError) {
      console.error('Error fetching posts for sync:', fetchError);
      return {
        success: false,
        postsSynced: 0,
        commentsSynced: 0,
        memoriesCreated: 0,
        skippedDuplicates: 0,
        error: fetchError,
      };
    }

    if (posts.length === 0) {
      console.log('No posts found to sync');
      return { success: true, postsSynced: 0, commentsSynced: 0, memoriesCreated: 0, skippedDuplicates: 0 };
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
        skippedDuplicates: 0,
        error: 'LIAM API keys not configured. Please configure your API keys first.',
      };
    }

    // Get list of already synced post/comment IDs to prevent duplicates
    const { data: syncedPosts } = await supabase
      .from('instagram_synced_posts')
      .select('instagram_post_id')
      .eq('user_id', userId);

    const syncedPostIds = new Set((syncedPosts || []).map((p: any) => p.instagram_post_id));
    console.log(`User has ${syncedPostIds.size} previously synced items (posts + comments)`);

    let postsSynced = 0;
    let commentsSynced = 0;
    let memoriesCreated = 0;
    let skippedDuplicates = 0;

    console.log(`Processing ${posts.length} posts from Instagram`);

    // Process each post
    for (const post of posts) {
      // SYNC POSTS: Skip if already synced (prevents duplicates)
      if (syncedPostIds.has(post.id)) {
        console.log(`Post ${post.id} already synced, skipping`);
        skippedDuplicates++;
      } else if (syncPosts && post.caption) {
        // Format post and get image URL separately
        const { content: memoryContent, imageUrl } = formatPostAsMemory(post);
        
        // Fetch image as base64 for permanent LIAM storage (if available)
        let imageBase64: string | null = null;
        if (imageUrl) {
          imageBase64 = await fetchImageAsBase64(imageUrl);
        }
        
        // Create memory with image (uses create-with-image endpoint if image available)
        const success = await createMemory(apiKeys, memoryContent, imageBase64);

        if (success) {
          // Record this post as synced to prevent future duplicates
          const { error: insertError } = await supabase
            .from('instagram_synced_posts')
            .insert({
              user_id: userId,
              instagram_post_id: post.id,
              synced_at: new Date().toISOString(),
            });

          if (insertError) {
            console.log(`Post ${post.id} sync record insert error:`, insertError.message);
          } else {
            memoriesCreated++;
            postsSynced++;
            // Add to set so we don't re-check in same run
            syncedPostIds.add(post.id);
          }
        }
      }

      // SYNC COMMENTS: Fetch and sync comments for this post if enabled
      if (syncComments) {
        const { comments } = await fetchPostComments(connectionId, post.id);

        for (const comment of comments) {
          // Create composite key for comment deduplication: {post_id}_comment_{comment_id}
          const commentKey = `${post.id}_comment_${comment.id}`;

          // Skip if already synced
          if (syncedPostIds.has(commentKey)) {
            console.log(`Comment ${comment.id} already synced, skipping`);
            skippedDuplicates++;
            continue;
          }

          const postMediaUrl = getFirstMediaUrl(post);
          const memoryContent = formatCommentAsMemory(comment, post.caption, postMediaUrl);
          
          // Comments don't get images stored - just text content
          const success = await createMemory(apiKeys, memoryContent, null);

          if (success) {
            // Record this comment as synced using composite key
            const { error: insertError } = await supabase
              .from('instagram_synced_posts')
              .insert({
                user_id: userId,
                instagram_post_id: commentKey,
                synced_at: new Date().toISOString(),
              });

            if (insertError) {
              console.log(`Comment ${comment.id} sync record insert error:`, insertError.message);
            } else {
              memoriesCreated++;
              commentsSynced++;
              syncedPostIds.add(commentKey);
            }
          }
        }
      }
    }

    console.log(`Sync complete: ${postsSynced} posts, ${commentsSynced} comments, ${skippedDuplicates} duplicates skipped`);

    // Update sync config with totals
    const updateData = {
      user_id: userId,
      last_sync_at: new Date().toISOString(),
      last_synced_post_id: posts[0]?.id,
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
      commentsSynced,
      memoriesCreated,
      skippedDuplicates,
    };
  } catch (error) {
    console.error('Sync error:', error);
    return {
      success: false,
      postsSynced: 0,
      commentsSynced: 0,
      memoriesCreated: 0,
      skippedDuplicates: 0,
      error: error instanceof Error ? error.message : 'Sync failed',
    };
  }
}

// Format a post as memory content and return image URL separately
function formatPostAsMemory(post: InstagramPost): { content: string; imageUrl: string | null } {
  const date = post.timestamp ? new Date(post.timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) : 'Unknown date';

  let memory = `Instagram Post`;
  if (post.username) {
    memory += ` by @${post.username}`;
  }
  memory += `\nPosted on ${date}\n\n`;

  // Include the caption as the main content
  if (post.caption) {
    memory += `"${post.caption}"\n\n`;
  }

  // Add engagement WITH context referencing the post above
  if (post.likesCount !== undefined || post.commentsCount !== undefined) {
    const parts = [];
    if (post.likesCount !== undefined) {
      parts.push(`${post.likesCount} like${post.likesCount !== 1 ? 's' : ''}`);
    }
    if (post.commentsCount !== undefined) {
      parts.push(`${post.commentsCount} comment${post.commentsCount !== 1 ? 's' : ''}`);
    }
    if (post.caption) {
      memory += `This post received ${parts.join(' and ')}.`;
    } else {
      memory += `Engagement: ${parts.join(', ')}`;
    }
  }

  // Get media URL for embedding in content AND for LIAM image upload
  const imageUrl = getFirstMediaUrl(post) || null;
  
  // IMPORTANT: Embed media URL in content as fallback for when LIAM API doesn't return images
  // This allows the frontend MemoryCard to display images via parseMediaUrl()
  if (imageUrl) {
    memory += `\n\n[media:${imageUrl}]`;
  }

  // Embed permalink for reference
  if (post.permalinkUrl) {
    memory += `\n[link:${post.permalinkUrl}]`;
  }

  return { content: memory, imageUrl };
}

// LIAM API Base URL (using working proxy due to DNS issues with official URL)
const LIAM_API_BASE = 'https://web.askbuddy.ai/devspacexdb/api';

// Fetch an image from URL and convert to base64 for LIAM storage
async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    console.log('Fetching image for base64 conversion:', imageUrl.slice(0, 80));
    
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MemoryBot/1.0)',
      },
    });
    
    if (!response.ok) {
      console.error('Failed to fetch image:', response.status);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Convert to base64
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const base64 = btoa(binary);
    
    console.log(`Image converted to base64: ${base64.length} chars, type: ${contentType}`);
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    return null;
  }
}

// Create memory by calling the liam-memory edge function (which has tested auth/signing)
async function createMemory(apiKeys: any, content: string, imageBase64?: string | null): Promise<boolean> {
  try {
    console.log('Creating memory via liam-memory function...');
    console.log('Content preview:', content.slice(0, 150));
    console.log('Has image:', !!imageBase64);
    
    // Call the liam-memory edge function which handles authentication properly
    // Use service role key for inter-function calls
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/liam-memory`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'x-supabase-user-id': apiKeys.user_id,
        },
        body: JSON.stringify({
          action: imageBase64 ? 'create-with-image' : 'create',
          content,
          tag: 'INSTAGRAM',
          image: imageBase64 || undefined,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('liam-memory function error:', response.status, errorText);
      return false;
    }

    const result = await response.json();
    console.log('Memory created successfully:', result?.processId || 'success');
    return result.success !== false;
  } catch (error) {
    console.error('Create memory error:', error);
    return false;
  }
}
