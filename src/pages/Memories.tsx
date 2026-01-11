import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { MemoryFilterBar } from "@/components/memories/MemoryFilterBar";
import { MemoryList } from "@/components/memories/MemoryList";
import { useLiamMemory } from "@/hooks/useLiamMemory";
import { Memory } from "@/types/memory";

export default function Memories() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [memories, setMemories] = useState<Memory[]>([]);
  const { listMemories, isListing } = useLiamMemory();

  useEffect(() => {
    async function fetchMemories() {
      const result = await listMemories();
      if (result) {
        setMemories(result);
      }
    }
    fetchMemories();
  }, []);

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
