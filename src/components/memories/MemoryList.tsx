import { useMemo } from "react";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { Memory, GroupedMemories } from "@/types/memory";
import { MemoryDateGroup } from "./MemoryDateGroup";
import { Loader2 } from "lucide-react";

interface MemoryListProps {
  memories: Memory[];
  isLoading: boolean;
  activeFilter: string;
}

function groupMemoriesByDate(memories: Memory[]): GroupedMemories[] {
  const groups: Record<string, Memory[]> = {};
  
  // Sort memories by date descending
  const sorted = [...memories].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  
  sorted.forEach((memory) => {
    const date = parseISO(memory.createdAt);
    const dateKey = format(date, 'yyyy-MM-dd');
    
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(memory);
  });
  
  return Object.entries(groups).map(([dateKey, memories]) => {
    const date = parseISO(dateKey);
    let label: string;
    
    if (isToday(date)) {
      label = "Today";
    } else if (isYesterday(date)) {
      label = "Yesterday";
    } else {
      label = format(date, "MMMM d, yyyy");
    }
    
    return {
      date: dateKey,
      label,
      memories,
    };
  });
}

function filterMemories(memories: Memory[], filter: string): Memory[] {
  if (filter === "all") return memories;
  
  return memories.filter((memory) => {
    if (!memory.tag) return false;
    return memory.tag.toLowerCase().includes(filter.toLowerCase());
  });
}

export function MemoryList({ memories, isLoading, activeFilter }: MemoryListProps) {
  const filteredMemories = useMemo(
    () => filterMemories(memories, activeFilter),
    [memories, activeFilter]
  );
  
  const groupedMemories = useMemo(
    () => groupMemoriesByDate(filteredMemories),
    [filteredMemories]
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">Loading memories...</p>
      </div>
    );
  }

  if (memories.length === 0) {
    return (
      <div className="rounded-2xl bg-card p-6 border border-border/50 text-center">
        <p className="text-sm text-muted-foreground">
          Your memories will appear here once you start creating them.
        </p>
      </div>
    );
  }

  if (filteredMemories.length === 0) {
    return (
      <div className="rounded-2xl bg-card p-6 border border-border/50 text-center">
        <p className="text-sm text-muted-foreground">
          No memories found for this filter.
        </p>
      </div>
    );
  }

  let runningIndex = 0;

  return (
    <div className="space-y-8">
      {groupedMemories.map((group) => {
        const groupStartIndex = runningIndex;
        runningIndex += group.memories.length;
        return (
          <MemoryDateGroup 
            key={group.date} 
            group={group} 
            startIndex={groupStartIndex}
          />
        );
      })}
    </div>
  );
}
