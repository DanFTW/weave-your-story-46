import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COMPOSIO_API_KEY = Deno.env.get('COMPOSIO_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LIAM_API_BASE = 'https://web.askbuddy.ai/devspacexdb/api';

// ─── Normalized item shape (decoupled from Composio response) ───

interface NormalizedItem {
  externalId: string;
  caption: string | null;
  mediaType: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalinkUrl: string | null;
  timestamp: string | null;
  username: string | null;
  likesCount: number | null;
  commentsCount: number | null;
  itemType: 'post' | 'story' | 'comment';
  children?: { id: string; media_type: string; media_url: string }[];
}

interface InstagramComment {
  id: string;
  text: string;
  timestamp: string;
  username?: string;
  from?: { id: string; username: string };
}

interface SyncCounts {
  fetched: number;
  saved: number;
  skipped: number;
  failed: number;
}

// ─── Fetch helpers ───

async function getInstagramUserId(connectionId: string): Promise<string | null> {
  try {
    console.log('[fetch] Getting Instagram user ID...');
    const response = await fetch('https://backend.composio.dev/api/v3/tools/execute/INSTAGRAM_GET_USER_INFO', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': COMPOSIO_API_KEY! },
      body: JSON.stringify({ connected_account_id: connectionId, arguments: {} }),
    });

    if (!response.ok) {
      console.error('[fetch] User info error:', response.status);
      return null;
    }

    const data = await response.json();
    const responseData = data.data || data;
    return responseData?.id || responseData?.response_data?.id || responseData?.user?.id || responseData?.ig_user_id || null;
  } catch (error) {
    console.error('[fetch] Error getting user ID:', error);
    return null;
  }
}

function extractMediaArray(data: any): any[] {
  const responseData = data.data || data;
  let mediaData = responseData?.response_data?.data ||
    responseData?.response_data ||
    responseData?.data ||
    responseData?.media?.data ||
    responseData;

  if (mediaData && typeof mediaData === 'object' && !Array.isArray(mediaData)) {
    mediaData = mediaData.data || mediaData.media || [];
  }

  if (!Array.isArray(mediaData)) {
    if (typeof mediaData === 'object' && mediaData !== null) {
      const keys = Object.keys(mediaData);
      if (keys.some(k => !isNaN(Number(k)))) return Object.values(mediaData);
    }
    return [];
  }
  return mediaData;
}

async function fetchInstagramPosts(connectionId: string, igUserId: string | null, limit: number): Promise<{ items: any[]; error?: string }> {
  try {
    console.log(`[fetch] Fetching posts, igUserId: ${igUserId}, limit: ${limit}`);
    const response = await fetch('https://backend.composio.dev/api/v3/tools/execute/INSTAGRAM_GET_USER_MEDIA', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': COMPOSIO_API_KEY! },
      body: JSON.stringify({
        connected_account_id: connectionId,
        arguments: { ...(igUserId && { ig_user_id: igUserId }), limit },
      }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      console.error('[fetch] Posts error:', response.status, responseText.slice(0, 300));
      return { items: [], error: `Failed to fetch posts: ${response.status}` };
    }

    const data = JSON.parse(responseText);
    const items = extractMediaArray(data);
    console.log(`[fetch] Got ${items.length} posts`);
    return { items };
  } catch (error) {
    console.error('[fetch] Posts error:', error);
    return { items: [], error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function fetchInstagramStories(connectionId: string): Promise<{ items: any[]; error?: string }> {
  try {
    console.log('[fetch] Fetching stories...');
    const response = await fetch('https://backend.composio.dev/api/v3/tools/execute/INSTAGRAM_GET_IG_USER_STORIES', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': COMPOSIO_API_KEY! },
      body: JSON.stringify({ connected_account_id: connectionId, arguments: {} }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      if (response.status === 404 && responseText.includes('not found')) {
        console.log('[fetch] Stories API not available via Composio — skipping');
        return { items: [] };
      }
      console.error('[fetch] Stories error:', response.status, responseText.slice(0, 300));
      return { items: [], error: `Failed to fetch stories: ${response.status}` };
    }

    const data = JSON.parse(responseText);
    const items = extractMediaArray(data);
    console.log(`[fetch] Got ${items.length} stories`);
    return { items };
  } catch (error) {
    console.error('[fetch] Stories error:', error);
    return { items: [], error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function fetchPostComments(connectionId: string, mediaId: string): Promise<{ comments: InstagramComment[]; error?: string }> {
  try {
    console.log(`[fetch] Comments for ${mediaId}...`);
    const response = await fetch('https://backend.composio.dev/api/v3/tools/execute/INSTAGRAM_GET_IG_MEDIA_COMMENTS', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': COMPOSIO_API_KEY! },
      body: JSON.stringify({ connected_account_id: connectionId, arguments: { ig_media_id: mediaId, limit: 50 } }),
    });

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 404 && errText.includes('not found')) {
        console.log(`[fetch] Comments API not available via Composio — skipping ${mediaId}`);
        return { comments: [] };
      }
      return { comments: [], error: `Failed: ${response.status}` };
    }

    const data = await response.json();
    const responseData = data?.data || data;
    let commentsData = responseData?.response_data?.data || responseData?.response_data?.comments?.data ||
      responseData?.data || responseData?.comments?.data || responseData?.comments || responseData;

    if (commentsData && typeof commentsData === 'object' && !Array.isArray(commentsData)) {
      commentsData = commentsData.data || [];
    }
    if (!Array.isArray(commentsData)) return { comments: [] };

    return {
      comments: commentsData.map((c: any) => ({
        id: c.id, text: c.text, timestamp: c.timestamp, username: c.username,
        from: c.from ? { id: c.from.id, username: c.from.username } : undefined,
      })),
    };
  } catch (error) {
    console.error('[fetch] Comments error:', error);
    return { comments: [], error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ─── Normalize helpers (decouple Composio shapes from internal types) ───

function normalizePost(raw: any): NormalizedItem | null {
  if (!raw?.id) return null;
  const mediaType = raw.media_type || raw.mediaType || 'IMAGE';
  return {
    externalId: raw.id,
    caption: raw.caption || null,
    mediaType,
    mediaUrl: raw.media_url || raw.mediaUrl || null,
    thumbnailUrl: raw.thumbnail_url || raw.thumbnailUrl || null,
    permalinkUrl: raw.permalink || raw.permalinkUrl || null,
    timestamp: raw.timestamp || null,
    username: raw.username || null,
    likesCount: raw.like_count ?? raw.likesCount ?? null,
    commentsCount: raw.comments_count ?? raw.commentsCount ?? null,
    itemType: 'post',
    children: raw.children?.data || raw.children,
  };
}

function normalizeStory(raw: any): NormalizedItem | null {
  if (!raw?.id) return null;
  return {
    externalId: `story_${raw.id}`,
    caption: raw.caption || null,
    mediaType: raw.media_type || raw.mediaType || 'IMAGE',
    mediaUrl: raw.media_url || raw.mediaUrl || null,
    thumbnailUrl: raw.thumbnail_url || raw.thumbnailUrl || null,
    permalinkUrl: raw.permalink || raw.permalinkUrl || null,
    timestamp: raw.timestamp || null,
    username: raw.username || null,
    likesCount: null,
    commentsCount: null,
    itemType: 'story',
  };
}

// ─── Transform helpers (format into canonical memory strings) ───

function getDisplayMediaUrl(item: NormalizedItem): string | null {
  if (item.mediaType === 'CAROUSEL_ALBUM' && item.children?.length) {
    return item.children[0].media_url || null;
  }
  if (item.mediaType === 'VIDEO') {
    return item.thumbnailUrl || item.mediaUrl;
  }
  return item.mediaUrl;
}

function formatDate(ts: string | null): string {
  if (!ts) return 'Unknown date';
  return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function mediaTypeLabel(mt: string): string {
  switch (mt) {
    case 'IMAGE': return 'Image';
    case 'VIDEO': return 'Reel/Video';
    case 'CAROUSEL_ALBUM': return 'Carousel';
    case 'STORY': return 'Story';
    default: return mt;
  }
}

function formatPostMemory(item: NormalizedItem): { content: string; imageUrl: string | null } {
  const date = formatDate(item.timestamp);
  const imageUrl = getDisplayMediaUrl(item) || null;

  let memory = `Instagram Post`;
  if (item.username) memory += ` by @${item.username}`;
  memory += ` | ${date}`;

  if (item.caption) {
    memory += `\nCaption: "${item.caption}"`;
  }

  const metaParts: string[] = [`Type: ${mediaTypeLabel(item.mediaType)}`];
  if (item.likesCount !== null) metaParts.push(`${item.likesCount} likes`);
  if (item.commentsCount !== null) metaParts.push(`${item.commentsCount} comments`);
  memory += `\n${metaParts.join(' | ')}`;

  if (imageUrl) memory += `\n[media:${imageUrl}]`;
  if (item.permalinkUrl) memory += ` [link:${item.permalinkUrl}]`;

  return { content: memory, imageUrl };
}

function formatStoryMemory(item: NormalizedItem): { content: string; imageUrl: string | null } {
  const date = formatDate(item.timestamp);
  const imageUrl = getDisplayMediaUrl(item) || null;

  let memory = `Instagram Story`;
  if (item.username) memory += ` by @${item.username}`;
  memory += ` | ${date}`;
  memory += `\nType: ${mediaTypeLabel(item.mediaType)}`;

  if (item.caption) {
    memory += `\nCaption: "${item.caption}"`;
  }

  if (imageUrl) memory += `\n[media:${imageUrl}]`;
  if (item.permalinkUrl) memory += ` [link:${item.permalinkUrl}]`;

  return { content: memory, imageUrl };
}

function formatCommentMemory(comment: InstagramComment, postCaption: string | undefined, postMediaUrl?: string): string {
  const date = formatDate(comment.timestamp);
  const commenterName = comment.from?.username || comment.username || 'someone';

  let memory = `Instagram Comment | ${date}\n@${commenterName} commented: "${comment.text}"`;
  if (postCaption) memory += `\nOn post: "${postCaption}"`;
  if (postMediaUrl) memory += `\n[media:${postMediaUrl}]`;
  return memory;
}

// ─── Persist helpers ───

function isDuplicate(syncedIds: Set<string>, externalId: string): boolean {
  return syncedIds.has(externalId);
}

async function persistSyncRecord(supabase: any, userId: string, externalId: string, memoryId?: string): Promise<boolean> {
  // Use upsert so orphaned records (no memory_id) get updated with the new memory_id
  const { error } = await supabase.from('instagram_synced_posts').upsert({
    user_id: userId,
    instagram_post_id: externalId,
    memory_id: memoryId || null,
    synced_at: new Date().toISOString(),
  }, { onConflict: 'user_id,instagram_post_id', ignoreDuplicates: false });
  if (error) {
    console.error(`[persist] Sync record error for ${externalId}:`, error.message);
    return false;
  }
  return true;
}

async function persistLocalContent(supabase: any, userId: string, item: NormalizedItem, imageUrl: string | null): Promise<void> {
  const { error } = await supabase.from('instagram_synced_post_content').upsert({
    user_id: userId,
    instagram_post_id: item.externalId,
    caption: item.caption,
    media_type: item.itemType === 'story' ? 'STORY' : (item.mediaType || null),
    media_url: imageUrl,
    permalink_url: item.permalinkUrl,
    username: item.username,
    likes_count: item.likesCount,
    comments_count: item.commentsCount,
    posted_at: item.timestamp,
    synced_at: new Date().toISOString(),
  }, { onConflict: 'user_id,instagram_post_id' });

  if (error) console.log(`[persist] Content store error for ${item.externalId}:`, error.message);
}

// ─── Image + Memory creation helpers ───

async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MemoryBot/1.0)' } });
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${btoa(binary)}`;
  } catch (error) {
    console.error('[image] Base64 conversion error:', error);
    return null;
  }
}

async function createMemory(apiKeys: any, content: string, imageBase64?: string | null): Promise<{ success: boolean; memoryId?: string }> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/liam-memory`, {
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
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[memory] Create error:', response.status, errorText.slice(0, 200));
      return { success: false };
    }

    const result = await response.json();
    const memoryId = result.memory?.id || result.id || result.memoryId || null;
    return { success: result.success !== false, memoryId: memoryId || undefined };
  } catch (error) {
    console.error('[memory] Create error:', error);
    return { success: false };
  }
}

// ─── Orchestrator ───

async function syncInstagramContent(
  supabase: any, userId: string, connectionId: string
): Promise<{
  success: boolean; postsSynced: number; commentsSynced: number;
  storiesSynced: number; memoriesCreated: number; skippedDuplicates: number; error?: string;
}> {
  try {
    const igUserId = await getInstagramUserId(connectionId);

    // Load config toggles
    const { data: config } = await supabase
      .from('instagram_sync_config').select('*').eq('user_id', userId).single();

    const syncPosts = config?.sync_posts ?? true;
    const syncComments = config?.sync_comments ?? true;
    const syncStories = config?.sync_stories ?? true;

    console.log(`[orchestrate] Config — posts: ${syncPosts}, comments: ${syncComments}, stories: ${syncStories}`);

    // Load API keys
    const { data: apiKeys } = await supabase
      .from('user_api_keys').select('*').eq('user_id', userId).single();

    if (!apiKeys) {
      return { success: false, postsSynced: 0, commentsSynced: 0, storiesSynced: 0, memoriesCreated: 0, skippedDuplicates: 0, error: 'LIAM API keys not configured.' };
    }

    // Load existing synced IDs for dedupe — only skip items that have a confirmed memory_id
    const { data: syncedPosts } = await supabase
      .from('instagram_synced_posts').select('instagram_post_id, memory_id').eq('user_id', userId);
    const allSyncedPosts = syncedPosts || [];
    const syncedWithMemory = allSyncedPosts.filter((p: any) => p.memory_id != null);
    const syncedWithoutMemory = allSyncedPosts.filter((p: any) => p.memory_id == null);
    const syncedIds = new Set<string>(syncedWithMemory.map((p: any) => p.instagram_post_id));
    const orphanedIds = new Set<string>(syncedWithoutMemory.map((p: any) => p.instagram_post_id));
    console.log(`[orchestrate] ${syncedIds.size} confirmed synced, ${orphanedIds.size} orphaned (will re-process)`);

    const postCounts: SyncCounts = { fetched: 0, saved: 0, skipped: 0, failed: 0 };
    const storyCounts: SyncCounts = { fetched: 0, saved: 0, skipped: 0, failed: 0 };
    let commentsSynced = 0;
    let totalMemories = 0;

    // ── Process posts ──
    if (syncPosts) {
      const { items: rawPosts, error: fetchError } = await fetchInstagramPosts(connectionId, igUserId, 50);
      if (fetchError) console.error('[orchestrate] Post fetch error:', fetchError);

      const posts = rawPosts.map(normalizePost).filter((p): p is NormalizedItem => p !== null);
      postCounts.fetched = posts.length;
      console.log(`[orchestrate] Normalized ${posts.length} posts`);

      for (const item of posts) {
        if (isDuplicate(syncedIds, item.externalId)) {
          postCounts.skipped++;
          continue;
        }

        try {
          const { content, imageUrl } = formatPostMemory(item);
          const imageBase64 = imageUrl ? await fetchImageAsBase64(imageUrl) : null;
          const { success: ok, memoryId } = await createMemory(apiKeys, content, imageBase64);

          if (ok) {
            await persistLocalContent(supabase, userId, item, imageUrl);
            const recorded = await persistSyncRecord(supabase, userId, item.externalId, memoryId);
            if (recorded) {
              postCounts.saved++;
              totalMemories++;
              syncedIds.add(item.externalId);
            }
          } else {
            postCounts.failed++;
          }
        } catch (err) {
          console.error(`[orchestrate] Post ${item.externalId} error:`, err);
          postCounts.failed++;
        }
      }

      // ── Process comments (only for fetched posts) ──
      if (syncComments) {
        for (const item of posts) {
          try {
            const { comments } = await fetchPostComments(connectionId, item.externalId);
            for (const comment of comments) {
              const commentKey = `${item.externalId}_comment_${comment.id}`;
              if (isDuplicate(syncedIds, commentKey)) continue;

              const postMediaUrl = getDisplayMediaUrl(item) || undefined;
              const content = formatCommentMemory(comment, item.caption || undefined, postMediaUrl);
              const ok = await createMemory(apiKeys, content, null);

              if (ok) {
                const recorded = await persistSyncRecord(supabase, userId, commentKey);
                if (recorded) {
                  commentsSynced++;
                  totalMemories++;
                  syncedIds.add(commentKey);
                }
              }
            }
          } catch (err) {
            console.error(`[orchestrate] Comments for ${item.externalId} error:`, err);
          }
        }
      }
    }

    // ── Process stories ──
    if (syncStories) {
      const { items: rawStories, error: storyFetchError } = await fetchInstagramStories(connectionId);
      if (storyFetchError) console.error('[orchestrate] Story fetch error:', storyFetchError);

      const stories = rawStories.map(normalizeStory).filter((s): s is NormalizedItem => s !== null);
      storyCounts.fetched = stories.length;
      console.log(`[orchestrate] Normalized ${stories.length} stories`);

      for (const item of stories) {
        if (isDuplicate(syncedIds, item.externalId)) {
          storyCounts.skipped++;
          continue;
        }

        try {
          const { content, imageUrl } = formatStoryMemory(item);
          const imageBase64 = imageUrl ? await fetchImageAsBase64(imageUrl) : null;
          const ok = await createMemory(apiKeys, content, imageBase64);

          if (ok) {
            await persistLocalContent(supabase, userId, item, imageUrl);
            const recorded = await persistSyncRecord(supabase, userId, item.externalId);
            if (recorded) {
              storyCounts.saved++;
              totalMemories++;
              syncedIds.add(item.externalId);
            }
          } else {
            storyCounts.failed++;
          }
        } catch (err) {
          console.error(`[orchestrate] Story ${item.externalId} error:`, err);
          storyCounts.failed++;
        }
      }
    }

    console.log(`[orchestrate] Done — posts: ${JSON.stringify(postCounts)}, stories: ${JSON.stringify(storyCounts)}, comments: ${commentsSynced}`);

    // Update config totals
    const updateData = {
      user_id: userId,
      last_sync_at: new Date().toISOString(),
      posts_synced_count: (config?.posts_synced_count || 0) + postCounts.saved,
      memories_created_count: (config?.memories_created_count || 0) + totalMemories,
      updated_at: new Date().toISOString(),
    };

    if (config?.id) {
      await supabase.from('instagram_sync_config').update(updateData).eq('id', config.id);
    } else {
      await supabase.from('instagram_sync_config').insert(updateData);
    }

    return {
      success: true,
      postsSynced: postCounts.saved,
      commentsSynced,
      storiesSynced: storyCounts.saved,
      memoriesCreated: totalMemories,
      skippedDuplicates: postCounts.skipped + storyCounts.skipped,
    };
  } catch (error) {
    console.error('[orchestrate] Sync error:', error);
    return {
      success: false, postsSynced: 0, commentsSynced: 0, storiesSynced: 0,
      memoriesCreated: 0, skippedDuplicates: 0,
      error: error instanceof Error ? error.message : 'Sync failed',
    };
  }
}

// ─── Request handler ───

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: integration } = await supabase
      .from('user_integrations').select('composio_connection_id')
      .eq('user_id', user.id).eq('integration_id', 'instagram').eq('status', 'connected').single();

    if (!integration?.composio_connection_id) {
      return new Response(JSON.stringify({ error: 'Instagram not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const connectionId = integration.composio_connection_id;
    const { action, limit = 25 } = await req.json();

    console.log(`Action: ${action}, user: ${user.id}`);

    switch (action) {
      case 'list-posts': {
        const igUserId = await getInstagramUserId(connectionId);
        const { items, error } = await fetchInstagramPosts(connectionId, igUserId, limit);
        const posts = items.map(normalizePost).filter(Boolean).map((p: any) => ({
          id: p.externalId, caption: p.caption, mediaType: p.mediaType,
          mediaUrl: p.mediaUrl, permalinkUrl: p.permalinkUrl,
          timestamp: p.timestamp, username: p.username,
          likesCount: p.likesCount, commentsCount: p.commentsCount,
        }));
        return new Response(JSON.stringify({ posts, ...(error && { error }) }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'sync': {
        const result = await syncInstagramContent(supabase, user.id, connectionId);
        return new Response(JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'reset-sync': {
        await supabase.from('instagram_sync_config').update({
          last_synced_post_id: null, last_sync_at: null,
          posts_synced_count: 0, memories_created_count: 0, updated_at: new Date().toISOString(),
        }).eq('user_id', user.id);

        return new Response(JSON.stringify({ success: true, message: 'Sync state reset.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'force-reset-sync': {
        await supabase.from('instagram_synced_post_content').delete().eq('user_id', user.id);
        await supabase.from('instagram_synced_posts').delete().eq('user_id', user.id);
        await supabase.from('instagram_sync_config').update({
          last_synced_post_id: null, last_sync_at: null,
          posts_synced_count: 0, memories_created_count: 0, updated_at: new Date().toISOString(),
        }).eq('user_id', user.id);

        return new Response(JSON.stringify({ success: true, message: 'Full reset complete.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'list-synced-posts': {
        const { data: posts } = await supabase.from('instagram_synced_post_content')
          .select('*').eq('user_id', user.id).order('posted_at', { ascending: false }).limit(100);
        return new Response(JSON.stringify({ posts: posts || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    console.error('Instagram sync error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
