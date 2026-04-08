import { useState, KeyboardEvent } from "react";
import { X, Plus, Loader2 } from "lucide-react";

interface InterestTagInputProps {
  tags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  isPrefilling?: boolean;
}

export function InterestTagInput({ tags, onAddTag, onRemoveTag, isPrefilling }: InterestTagInputProps) {
  const [input, setInput] = useState("");

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (tags.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
      setInput("");
      return;
    }
    onAddTag(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-3">
      {/* Tag chips */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium"
            >
              {tag}
              <button
                type="button"
                onClick={() => onRemoveTag(tag)}
                className="ml-0.5 hover:text-destructive transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? "e.g. live music, tech meetups…" : "Add another interest…"}
          className="flex-1 h-10 px-3 bg-muted rounded-[14px] text-foreground placeholder:text-muted-foreground/60 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!input.trim()}
          className="h-10 px-3 rounded-[14px] bg-primary/10 text-primary text-sm font-medium flex items-center gap-1 disabled:opacity-40 transition-opacity hover:bg-primary/20"
        >
          {isPrefilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add
        </button>
      </div>
    </div>
  );
}
