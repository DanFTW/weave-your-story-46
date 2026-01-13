import { llmImportCategories } from "@/data/llmImportCategories";
import { LLMImportCategory } from "@/types/llmImport";
import { LLMImportCategoryCard } from "./LLMImportCategoryCard";

interface LLMImportCategoryListProps {
  onSelectCategory: (category: LLMImportCategory) => void;
}

export function LLMImportCategoryList({ onSelectCategory }: LLMImportCategoryListProps) {
  return (
    <div className="px-5 pb-8">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Choose a category</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Select what type of memories to extract from your LLM
        </p>
      </div>
      
      <div className="flex flex-col gap-3">
        {llmImportCategories.map((category) => (
          <LLMImportCategoryCard
            key={category.id}
            category={category}
            onClick={() => onSelectCategory(category)}
          />
        ))}
      </div>
    </div>
  );
}
