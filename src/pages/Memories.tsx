import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { MemoryFilterBar } from "@/components/memories/MemoryFilterBar";
import { MemoryList } from "@/components/memories/MemoryList";
import { SharedWithMeList } from "@/components/memories/SharedWithMeList";
import { ShareMemoryModal } from "@/components/memories/ShareMemoryModal";
import { useLiamMemory } from "@/hooks/useLiamMemory";
import { useDeletedMemories } from "@/hooks/useDeletedMemories";
import { useTwitterAlphaPosts } from "@/hooks/useTwitterAlphaPosts";
import { useInstagramPosts } from "@/hooks/useInstagramPosts";
import { useSharedWithMe } from "@/hooks/useSharedWithMe";
import { Memory } from "@/types/memory";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

// Format Instagram post for display
function formatInstagramMemory(post: {
  caption: string | null;
  username: string | null;
  likes_count: number | null;
  comments_count: number | null;
  permalink_url: string | null;
}): string {
  let content = '';
  
  if (post.username) {
    content += `@${post.username}: `;
  }
  
  if (post.caption) {
    content += post.caption;
  } else {
    content += '(no caption)';
  }
  
  // Add engagement info
  const engagement = [];
  if (post.likes_count !== null) {
    engagement.push(`${post.likes_count} like${post.likes_count !== 1 ? 's' : ''}`);
  }
  if (post.comments_count !== null) {
    engagement.push(`${post.comments_count} comment${post.comments_count !== 1 ? 's' : ''}`);
  }
  if (engagement.length > 0) {
    content += ` • ${engagement.join(', ')}`;
  }
  
  return content;
}

export default function Memories() {
  const [searchParams] = useSearchParams();
  const [activeFilter, setActiveFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  // Default to 'shared' view if the URL has ?view=shared (set by SharedMemory redirect)
  const [memoryView, setMemoryView] = useState<'mine' | 'shared'>(
    searchParams.get('view') === 'shared' ? 'shared' : 'mine'
  );
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sharingMemory, setSharingMemory] = useState<Memory | null>(null);
  const [apiKeysRequired, setApiKeysRequired] = useState(false);
  const { listMemories, isListing } = useLiamMemory();
  const { filterDeleted, clearAll, deletedIds } = useDeletedMemories();
  const { posts: twitterPosts, fetchPosts: fetchTwitterPosts, isLoading: isLoadingTwitter } = useTwitterAlphaPosts();
  const { posts: instagramPosts, fetchPosts: fetchInstagramPosts, isLoading: isLoadingInstagram } = useInstagramPosts();
  const { items: sharedItems, isLoading: isLoadingShared, fetch: fetchShared } = useSharedWithMe();

  const fetchMemories = useCallback(async () => {
    const result = await listMemories();
    if (result === null) {
      // null means the API call failed — could be missing API keys
      // useLiamMemory already shows a toast; we surface the setup state here
      setApiKeysRequired(true);
      return;
    }
    setApiKeysRequired(false);
    console.log('[Memories] Raw memories from API:', result.length);
    console.log('[Memories] Deleted IDs in cache:', Array.from(deletedIds));
    const filteredResult = filterDeleted(result);
    console.log('[Memories] After filtering deleted:', filteredResult.length);
    setMemories(filteredResult);
  }, [listMemories, filterDeleted, deletedIds]);

  // Convert locally stored Twitter posts to Memory format
  const twitterAsMemories = useMemo((): Memory[] => {
    return twitterPosts.map(post => ({
      id: `twitter-local-${post.tweet_id}`,
      content: `@${post.author_username}: ${post.tweet_text}`,
      tag: 'TWITTER',
      createdAt: post.tweet_created_at,
    }));
  }, [twitterPosts]);

  // Convert locally stored Instagram posts to Memory format
  const instagramAsMemories = useMemo((): Memory[] => {
    return instagramPosts.map(post => ({
      id: `instagram-local-${post.instagram_post_id}`,
      content: formatInstagramMemory(post),
      tag: 'INSTAGRAM',
      createdAt: post.posted_at || post.synced_at,
      // Store media_url for potential image display
      imageDataBase64: null,
    }));
  }, [instagramPosts]);

  // Merge LIAM memories with locally stored Twitter & Instagram posts
  const allMemories = useMemo((): Memory[] => {
    // Combine all sources
    const combined = [...memories, ...twitterAsMemories, ...instagramAsMemories];
    
    // Deduplicate by source ID (in case LIAM also stored some)
    const seen = new Set<string>();
    const deduped = combined.filter(m => {
      // For twitter-local entries, extract tweet_id
      if (m.id.startsWith('twitter-local-')) {
        const tweetId = m.id.replace('twitter-local-', '');
        if (seen.has(`twitter-${tweetId}`)) return false;
        seen.add(`twitter-${tweetId}`);
      }
      // For instagram-local entries, extract post_id
      if (m.id.startsWith('instagram-local-')) {
        const postId = m.id.replace('instagram-local-', '');
        if (seen.has(`instagram-${postId}`)) return false;
        seen.add(`instagram-${postId}`);
      }
      return true;
    });
    
    // Sort by createdAt descending
    return deduped.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [memories, twitterAsMemories, instagramAsMemories]);

  // Initial fetch on mount
  useEffect(() => {
    fetchMemories();
    fetchTwitterPosts();
    fetchInstagramPosts();
  }, []); // Only run on mount

  // Consume a pending share token (set by SharedMemory page for unauthed users
  // who sign in / sign up outside the share redirect path)
  useEffect(() => {
    const pendingToken = localStorage.getItem("pendingShareToken");
    if (!pendingToken) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      // Resolve with auth so the edge fn registers this user as a recipient
      supabase.functions.invoke("memory-share", {
        body: { action: "resolve", share_token: pendingToken },
      }).then(() => {
        localStorage.removeItem("pendingShareToken");
        setMemoryView("shared");
        fetchShared();
      }).catch(() => {
        // Don't block the user even if resolution fails
        localStorage.removeItem("pendingShareToken");
      });
    });
  }, []); // Only run on mount

  // Lazily fetch shared items when user switches to that tab
  useEffect(() => {
    if (memoryView === 'shared' && sharedItems.length === 0 && !isLoadingShared) {
      fetchShared();
    }
  }, [memoryView]);

  // Refetch when filterDeleted changes (after localStorage loads)
  useEffect(() => {
    if (memories.length > 0) {
      setMemories(prev => filterDeleted(prev));
    }
  }, [filterDeleted]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (memoryView === 'shared') {
      await fetchShared();
    } else {
      await Promise.all([fetchMemories(), fetchTwitterPosts(), fetchInstagramPosts()]);
    }
    setIsRefreshing(false);
  };

  const isLoading = isListing || isLoadingTwitter || isLoadingInstagram;

  return (
    <div className="pb-nav">
      <div className="px-5">
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="pt-safe-top pb-6"
        >
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-foreground tracking-tight">
              Memories
            </h1>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearAll();
                  fetchMemories();
                }}
                className="text-xs text-muted-foreground"
              >
                Clear Cache
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={isLoading || isRefreshing || isLoadingShared}
                className="shrink-0"
              >
                <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            All your saved memories
            {(twitterAsMemories.length > 0 || instagramAsMemories.length > 0) && (
              <span className="ml-1">
                ({[
                  twitterAsMemories.length > 0 && `${twitterAsMemories.length} Twitter`,
                  instagramAsMemories.length > 0 && `${instagramAsMemories.length} Instagram`,
                ].filter(Boolean).join(', ')})
              </span>
            )}
          </p>
        </motion.header>
        
        {/* Filter Bar */}
        <div className="mt-6 mb-8">
          <MemoryFilterBar 
            activeFilter={activeFilter}
            statusFilter={statusFilter}
            onFilterChange={setActiveFilter}
            onStatusFilterChange={setStatusFilter}
            memoryView={memoryView}
            onMemoryViewChange={setMemoryView}
          />
        </div>
        
        {/* Memory List — conditional on view */}
        {memoryView === 'mine' ? (
          <MemoryList 
            memories={allMemories}
            isLoading={isLoading}
            activeFilter={activeFilter}
            onShare={(memory) => setSharingMemory(memory)}
            apiKeysRequired={apiKeysRequired}
          />
        ) : (
          <SharedWithMeList
            items={sharedItems}
            isLoading={isLoadingShared}
            activeFilter={activeFilter}
          />
        )}
      </div>

      {/* Share Modal */}
      <ShareMemoryModal
        memory={sharingMemory}
        open={!!sharingMemory}
        onOpenChange={(open) => { if (!open) setSharingMemory(null); }}
      />
    </div>
  );
}
