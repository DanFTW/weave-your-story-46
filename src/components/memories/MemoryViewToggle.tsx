import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type MemoryView = 'mine' | 'shared';

interface MemoryViewToggleProps {
  value: MemoryView;
  onChange: (v: MemoryView) => void;
}

const options: { id: MemoryView; label: string }[] = [
  { id: 'mine', label: 'Mine' },
  { id: 'shared', label: 'Shared with Me' },
];

export function MemoryViewToggle({ value, onChange }: MemoryViewToggleProps) {
  return (
    <div className="flex items-center bg-secondary rounded-full p-1 gap-0.5 w-full">
      {options.map((opt) => {
        const isActive = value === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={cn(
              "relative flex-1 h-8 rounded-full text-sm font-medium transition-colors duration-150 z-10",
              isActive ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {isActive && (
              <motion.div
                layoutId="memoryViewActive"
                className="absolute inset-0 bg-background rounded-full shadow-sm"
                initial={false}
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
                style={{ zIndex: -1 }}
              />
            )}
            <span className="relative">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
