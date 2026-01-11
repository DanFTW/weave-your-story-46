import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { MemoryFilterBar } from "@/components/memories/MemoryFilterBar";
import { MemoryList } from "@/components/memories/MemoryList";
import { useLiamMemory } from "@/hooks/useLiamMemory";
import { Memory } from "@/types/memory";

export default function Memories() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const { listMemories, isListing } = useLiamMemory();
  const location = useLocation();

  // Handle deleted memory ID passed from MemoryDetail page
  useEffect(() => {
    const state = location.state as { deletedMemoryId?: string } | null;
    if (state?.deletedMemoryId) {
      setDeletedIds(prev => new Set(prev).add(state.deletedMemoryId!));
      // Clear the state so it doesn't persist on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    async function fetchMemories() {
      const result = await listMemories();
      if (result) {
        // Filter out any memories that were just deleted (handles API eventual consistency)
        const filteredResult = result.filter(m => !deletedIds.has(m.id));
        setMemories(filteredResult);
      }
    }
    fetchMemories();
  }, [deletedIds]);

  return (
    <div className="pb-nav">
      <div className="px-5 pt-14">
        <PageHeader 
          title="Memories" 
          subtitle="All your saved memories" 
        />
        
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
