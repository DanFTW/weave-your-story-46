import { useState, useEffect, useCallback } from "react";
import { MemoryFilterBar } from "@/components/memories/MemoryFilterBar";
import { MemoryList } from "@/components/memories/MemoryList";
import { useLiamMemory } from "@/hooks/useLiamMemory";
import { useDeletedMemories } from "@/hooks/useDeletedMemories";
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

  const fetchMemories = useCallback(async () => {
    const result = await listMemories();
    if (result) {
      console.log('[Memories] Raw memories from API:', result.length);
      console.log('[Memories] Deleted IDs in cache:', Array.from(deletedIds));
      // Filter out any memories that were deleted locally
      // (handles LIAM API eventual consistency - list may return stale data)
      const filteredResult = filterDeleted(result);
      console.log('[Memories] After filtering deleted:', filteredResult.length);
      
      // Log Twitter memories specifically
      const twitterMemories = filteredResult.filter(m => 
        m.tag?.toLowerCase().includes('twitter') || 
        m.content?.toLowerCase().includes('twitter')
      );
      console.log('[Memories] Twitter memories found:', twitterMemories.length, twitterMemories);
      
      setMemories(filteredResult);
    }
  }, [listMemories, filterDeleted, deletedIds]);

  // Initial fetch on mount
  useEffect(() => {
    fetchMemories();
  }, []); // Only run on mount - filterDeleted reference changes shouldn't trigger refetch

  // Refetch when filterDeleted changes (after localStorage loads)
  useEffect(() => {
    if (memories.length > 0) {
      setMemories(prev => filterDeleted(prev));
    }
  }, [filterDeleted]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchMemories();
    setIsRefreshing(false);
  };

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
                disabled={isListing || isRefreshing}
                className="shrink-0"
              >
                <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">All your saved memories</p>
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
          memories={memories}
          isLoading={isListing}
          activeFilter={activeFilter}
        />
      </div>
    </div>
  );
}
