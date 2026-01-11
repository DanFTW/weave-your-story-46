import { useMemo } from "react";
import { GroupedMemories, Memory } from "@/types/memory";
import { MemoryStack } from "./MemoryStack";
import { MemoryCard } from "./MemoryCard";

interface MemoryDateGroupProps {
  group: GroupedMemories;
  startIndex: number;
}

interface CategoryGroup {
  category: string;
  memories: Memory[];
}

function groupByCategory(memories: Memory[]): CategoryGroup[] {
  const groups: Record<string, Memory[]> = {};
  
  memories.forEach((memory) => {
    const category = memory.category?.toLowerCase().replace(/\s+/g, '_') || 'default';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(memory);
  });
  
  return Object.entries(groups).map(([category, memories]) => ({
    category,
    memories,
  }));
}

export function MemoryDateGroup({ group, startIndex }: MemoryDateGroupProps) {
  const categoryGroups = useMemo(() => groupByCategory(group.memories), [group.memories]);
  
  let runningIndex = startIndex;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">
        {group.label}
      </h2>
      <div className="space-y-3">
        {categoryGroups.map((catGroup) => {
          const groupIndex = runningIndex;
          runningIndex += catGroup.memories.length;
          
          if (catGroup.memories.length > 1) {
            return (
              <MemoryStack 
                key={`${group.date}-${catGroup.category}`}
                memories={catGroup.memories}
                category={catGroup.category}
                index={groupIndex}
              />
            );
          }
          
          return (
            <MemoryCard 
              key={catGroup.memories[0].id}
              memory={catGroup.memories[0]}
              index={groupIndex}
            />
          );
        })}
      </div>
    </div>
  );
}
