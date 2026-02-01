import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { InstagramStoredPost } from "@/types/instagramSync";

/**
 * Hook to fetch locally stored Instagram posts for reliable 1:1 display.
 * Uses hybrid storage pattern: LIAM for semantic search, local DB for display.
 */
export function useInstagramPosts() {
  const [posts, setPosts] = useState<InstagramStoredPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('instagram-sync', {
        body: { action: 'list-synced-posts' },
      });

      if (invokeError) {
        console.error('[useInstagramPosts] Error fetching posts:', invokeError);
        setError(invokeError.message);
        return;
      }

      if (data?.posts) {
        console.log(`[useInstagramPosts] Fetched ${data.posts.length} locally stored Instagram posts`);
        setPosts(data.posts);
      } else {
        setPosts([]);
      }
    } catch (err) {
      console.error('[useInstagramPosts] Unexpected error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch Instagram posts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearPosts = useCallback(() => {
    setPosts([]);
  }, []);

  return { 
    posts, 
    isLoading, 
    error, 
    fetchPosts,
    clearPosts,
  };
}
