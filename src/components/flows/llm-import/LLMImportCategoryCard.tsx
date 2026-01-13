import { ChevronRight } from "lucide-react";
import { LLMImportCategory } from "@/types/llmImport";

interface LLMImportCategoryCardProps {
  category: LLMImportCategory;
  onClick: () => void;
}

export function LLMImportCategoryCard({ category, onClick }: LLMImportCategoryCardProps) {
  const Icon = category.icon;
  
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 bg-card rounded-2xl border border-border/50 shadow-sm hover:shadow-md hover:border-border transition-all text-left group"
    >
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-foreground">{category.title}</h3>
        <p className="text-sm text-muted-foreground line-clamp-1">
          {category.description}
        </p>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
    </button>
  );
}
