import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import { MemoryFilterBar } from "@/components/memories/MemoryFilterBar";
import { MemoryList } from "@/components/memories/MemoryList";
import { useLiamMemory } from "@/hooks/useLiamMemory";
import { useDeletedMemories } from "@/hooks/useDeletedMemories";
import { Memory } from "@/types/memory";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Memories() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { listMemories, isListing } = useLiamMemory();
  const { filterDeleted } = useDeletedMemories();

  const fetchMemories = useCallback(async () => {
    const result = await listMemories();
    if (result) {
      // Filter out any memories that were deleted locally
      // (handles LIAM API eventual consistency - list may return stale data)
      const filteredResult = filterDeleted(result);
      setMemories(filteredResult);
    }
  }, [listMemories, filterDeleted]);

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
        <div className="flex items-start justify-between">
          <PageHeader 
            title="Memories" 
            subtitle="All your saved memories" 
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isListing || isRefreshing}
            className="mt-6 shrink-0"
          >
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
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
