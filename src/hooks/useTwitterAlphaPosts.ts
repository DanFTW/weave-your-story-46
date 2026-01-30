import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TwitterAlphaPost } from "@/types/twitterAlphaTracker";

export function useTwitterAlphaPosts() {
  const [posts, setPosts] = useState<TwitterAlphaPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase.functions.invoke(
        "twitter-alpha-tracker",
        {
          body: { action: "list-posts" },
        }
      );

      if (fetchError) {
        console.error("Error fetching Twitter posts:", fetchError);
        setError(fetchError.message);
        return;
      }

      if (data?.posts) {
        setPosts(data.posts);
      }
    } catch (err) {
      console.error("Exception fetching Twitter posts:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch posts");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { posts, isLoading, error, fetchPosts };
}
