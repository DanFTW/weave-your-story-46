import { useState, useEffect } from "react";
import { Sparkles, Check, Plus, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TAG_CATEGORIES, getTagById, TagConfig } from "@/data/tagConfig";
import { useTagSuggestions } from "@/hooks/useTagSuggestions";
import { cn } from "@/lib/utils";

interface TagSelectionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTag?: string;
  memoryContent?: string;
  onSelectTag: (tag: string) => Promise<void> | void;
  isLoading?: boolean;
}

/**
 * Bottom sheet for selecting memory tags.
 * Features AI-powered suggestions, predefined categories, and custom tag input.
 */
export function TagSelectionSheet({
  open,
  onOpenChange,
  currentTag,
  memoryContent,
  onSelectTag,
  isLoading = false,
}: TagSelectionSheetProps) {
  const [customTag, setCustomTag] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | undefined>(currentTag);
  const [isSaving, setIsSaving] = useState(false);
  const { suggestTags, isLoading: isSuggesting, cachedTags } = useTagSuggestions();
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);

  // Fetch AI suggestions when content changes
  useEffect(() => {
    if (open && memoryContent && memoryContent.length >= 10) {
      suggestTags(memoryContent).then(tags => {
        setAiSuggestions(tags);
      });
    }
  }, [open, memoryContent, suggestTags]);

  // Reset state when sheet opens
  useEffect(() => {
    if (open) {
      setSelectedTag(currentTag);
      setCustomTag("");
    }
  }, [open, currentTag]);

  const handleSelectTag = async (tagId: string) => {
    if (isLoading || isSaving) return;
    
    setSelectedTag(tagId);
    setIsSaving(true);
    
    try {
      await onSelectTag(tagId);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCustomTagSubmit = async () => {
    if (!customTag.trim() || isLoading || isSaving) return;
    
    const normalizedTag = customTag.trim().toLowerCase().replace(/\s+/g, '_');
    setSelectedTag(normalizedTag);
    setIsSaving(true);
    
    try {
      await onSelectTag(normalizedTag);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Get primary tags for selection
  const primaryTags = TAG_CATEGORIES.slice(0, 8);

  // Get AI suggested tag configs
  const suggestedTagConfigs = aiSuggestions
    .map(tagId => getTagById(tagId))
    .filter((config, index, self) => 
      self.findIndex(c => c.id === config.id) === index
    );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-3xl px-5 pb-8">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-lg font-semibold">Select Tag</SheetTitle>
        </SheetHeader>

        <div className="space-y-5">
          {/* AI Suggestions Section */}
          {(isSuggesting || suggestedTagConfigs.length > 0) && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-violet-500" />
                <span className="text-sm font-medium text-muted-foreground">
                  AI Suggestions
                </span>
                {isSuggesting && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </div>
              
              {isSuggesting ? (
                <div className="flex gap-2">
                  {[1, 2, 3].map(i => (
                    <div 
                      key={i}
                      className="h-9 w-20 rounded-full bg-muted animate-pulse" 
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {suggestedTagConfigs.map((config) => (
                    <TagPill
                      key={config.id}
                      config={config}
                      isSelected={selectedTag === config.id}
                      onClick={() => handleSelectTag(config.id)}
                      disabled={isSaving}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Category Tags */}
          <div>
            <span className="text-sm font-medium text-muted-foreground mb-3 block">
              Categories
            </span>
            <div className="flex flex-wrap gap-2">
              {primaryTags.map((config) => (
                <TagPill
                  key={config.id}
                  config={config}
                  isSelected={selectedTag === config.id}
                  onClick={() => handleSelectTag(config.id)}
                  disabled={isSaving}
                />
              ))}
            </div>
          </div>

          {/* Custom Tag Input */}
          <div>
            <span className="text-sm font-medium text-muted-foreground mb-3 block">
              Custom Tag
            </span>
            <div className="flex gap-2">
              <Input
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                placeholder="Enter custom tag..."
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCustomTagSubmit();
                  }
                }}
              />
              <Button
                size="icon"
                onClick={handleCustomTagSubmit}
                disabled={!customTag.trim() || isSaving}
                className="shrink-0"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface TagPillProps {
  config: TagConfig;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function TagPill({ config, isSelected, onClick, disabled }: TagPillProps) {
  const Icon = config.icon;
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-all",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        isSelected
          ? cn(config.gradient, "text-white shadow-md")
          : "bg-muted text-muted-foreground hover:bg-accent",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {isSelected ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Icon className="h-3.5 w-3.5" />
      )}
      <span>{config.label}</span>
    </button>
  );
}
