import { useState, useEffect, useCallback, useMemo } from "react";
import { MemoryFilterBar } from "@/components/memories/MemoryFilterBar";
import { MemoryList } from "@/components/memories/MemoryList";
import { useLiamMemory } from "@/hooks/useLiamMemory";
import { useDeletedMemories } from "@/hooks/useDeletedMemories";
import { useTwitterAlphaPosts } from "@/hooks/useTwitterAlphaPosts";
import { Memory } from "@/types/memory";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function Memories() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { listMemories, isListing } = useLiamMemory();
  const { filterDeleted, clearAll, deletedIds } = useDeletedMemories();
  const { posts: twitterPosts, fetchPosts: fetchTwitterPosts, isLoading: isLoadingTwitter } = useTwitterAlphaPosts();

  const fetchMemories = useCallback(async () => {
    const result = await listMemories();
    if (result) {
      console.log('[Memories] Raw memories from API:', result.length);
      console.log('[Memories] Deleted IDs in cache:', Array.from(deletedIds));
      // Filter out any memories that were deleted locally
      // (handles LIAM API eventual consistency - list may return stale data)
      const filteredResult = filterDeleted(result);
      console.log('[Memories] After filtering deleted:', filteredResult.length);
      
      setMemories(filteredResult);
    }
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

  // Merge LIAM memories with locally stored Twitter posts
  const allMemories = useMemo((): Memory[] => {
    // Combine both sources
    const combined = [...memories, ...twitterAsMemories];
    
    // Deduplicate by tweet_id (in case LIAM also stored some)
    const seen = new Set<string>();
    const deduped = combined.filter(m => {
      // For twitter-local entries, extract tweet_id
      if (m.id.startsWith('twitter-local-')) {
        const tweetId = m.id.replace('twitter-local-', '');
        if (seen.has(tweetId)) return false;
        seen.add(tweetId);
      }
      return true;
    });
    
    // Sort by createdAt descending
    return deduped.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [memories, twitterAsMemories]);

  // Initial fetch on mount
  useEffect(() => {
    fetchMemories();
    fetchTwitterPosts();
  }, []); // Only run on mount

  // Refetch when filterDeleted changes (after localStorage loads)
  useEffect(() => {
    if (memories.length > 0) {
      setMemories(prev => filterDeleted(prev));
    }
  }, [filterDeleted]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchMemories(), fetchTwitterPosts()]);
    setIsRefreshing(false);
  };

  const isLoading = isListing || isLoadingTwitter;

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
                disabled={isLoading || isRefreshing}
                className="shrink-0"
              >
                <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            All your saved memories {twitterAsMemories.length > 0 ? `(${twitterAsMemories.length} from Twitter)` : ''}
          </p>
        </motion.header>
        
        {/* Filter Bar */}
        <div className="mt-6 mb-8">
          <MemoryFilterBar 
            activeFilter={activeFilter}
            statusFilter={statusFilter}
            onFilterChange={setActiveFilter}
            onStatusFilterChange={setStatusFilter}
          />
        </div>
        
        {/* Memory List */}
        <MemoryList 
          memories={allMemories}
          isLoading={isLoading}
          activeFilter={activeFilter}
        />
      </div>
    </div>
  );
}
