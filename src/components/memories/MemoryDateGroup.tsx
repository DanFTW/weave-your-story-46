import { GroupedMemories } from "@/types/memory";
import { MemoryCard } from "./MemoryCard";

interface MemoryDateGroupProps {
  group: GroupedMemories;
  startIndex: number;
}

export function MemoryDateGroup({ group, startIndex }: MemoryDateGroupProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">
        {group.label}
      </h2>
      <div className="space-y-4">
        {group.memories.map((memory, index) => (
          <MemoryCard 
            key={memory.id} 
            memory={memory} 
            index={startIndex + index}
          />
        ))}
      </div>
    </div>
  );
}
