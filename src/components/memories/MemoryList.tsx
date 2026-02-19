import { useMemo } from "react";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { Memory, GroupedMemories } from "@/types/memory";
import { MemoryDateGroup } from "./MemoryDateGroup";
import { Loader2, KeyRound } from "lucide-react";
import { consolidateInstagramMemories } from "@/utils/consolidateInstagramMemories";
import { useNavigate } from "react-router-dom";

interface MemoryListProps {
  memories: Memory[];
  isLoading: boolean;
  activeFilter: string;
  onShare?: (memory: Memory) => void;
  apiKeysRequired?: boolean;
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
  const lowerFilter = filter.toLowerCase().replace(/_/g, ' ');
  return memories.filter(m => {
    const categoryMatch = m.category?.toLowerCase().replace(/_/g, ' ').includes(lowerFilter);
    const tagMatch = m.tag?.toLowerCase().replace(/_/g, ' ').includes(lowerFilter);
    return categoryMatch || tagMatch;
  });
}

export function MemoryList({ memories, isLoading, activeFilter, onShare, apiKeysRequired }: MemoryListProps) {
  const navigate = useNavigate();

  // Step 1: Consolidate Instagram fragments using stable shortcode identifier
  const consolidatedMemories = useMemo(
    () => consolidateInstagramMemories(memories),
    [memories]
  );

  // Step 2: Apply filter
  const filteredMemories = useMemo(
    () => filterMemories(consolidatedMemories, activeFilter),
    [consolidatedMemories, activeFilter]
  );
  
  // Step 3: Group by date
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

  if (apiKeysRequired) {
    return (
      <div className="rounded-2xl bg-card p-8 border border-border/50 text-center space-y-4">
        <div className="flex justify-center">
          <div className="rounded-full bg-muted p-3">
            <KeyRound className="h-6 w-6 text-muted-foreground" />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">API keys required</p>
          <p className="text-xs text-muted-foreground">
            Configure your LIAM API keys to start saving and viewing memories.
          </p>
        </div>
        <button
          onClick={() => navigate('/api-key-config')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <KeyRound className="h-3.5 w-3.5" />
          Configure API Keys
        </button>
      </div>
    );
  }

  if (memories.length === 0) {
    return (
      <div className="rounded-2xl bg-card p-6 border border-border/50 text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          Your memories will appear here once you start creating them.
        </p>
        <p className="text-xs text-muted-foreground/70">
          Just created a memory? It may take a moment to sync. Try refreshing with the button above.
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
            onShare={onShare}
          />
        );
      })}
    </div>
  );
}
