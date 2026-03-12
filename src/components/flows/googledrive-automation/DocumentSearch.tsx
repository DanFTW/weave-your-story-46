import { useState, useRef, useEffect } from "react";
import { Search, Loader2, FileText, Check, HardDrive, Cloud } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GoogleDriveSearchResult, DocSource } from "@/types/googleDriveAutomation";
import { cn } from "@/lib/utils";

interface DocumentSearchProps {
  isSearching: boolean;
  searchResults: GoogleDriveSearchResult[];
  isSaving: Record<string, boolean>;
  activeSource: DocSource;
  availableSources: DocSource[];
  onSourceChange: (source: DocSource) => void;
  onSearch: (query: string) => void;
  onGenerate: (fileId: string, fileName: string) => void;
}

const sourceConfig: Record<DocSource, { label: string; icon: typeof HardDrive; color: string }> = {
  googledrive: { label: "Google Drive", icon: HardDrive, color: "#4285F4" },
  dropbox: { label: "Dropbox", icon: Cloud, color: "#0061FF" },
};

export function DocumentSearch({
  isSearching, searchResults, isSaving,
  activeSource, availableSources, onSourceChange,
  onSearch, onGenerate,
}: DocumentSearchProps) {
  const [query, setQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const handleSourceChange = (source: DocSource) => {
    if (source === activeSource) return;
    setQuery("");
    setHasSearched(false);
    onSourceChange(source);
  };

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    const trimmed = value.trim();
    if (!trimmed) {
      setHasSearched(false);
      return;
    }

    debounceTimer.current = setTimeout(() => {
      setHasSearched(true);
      onSearch(trimmed);
    }, 300);
  };

  const handleSearch = () => {
    if (!query.trim()) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setHasSearched(true);
    onSearch(query.trim());
  };

  const showToggle = availableSources.length > 1;
  const activeCfg = sourceConfig[activeSource];

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Search Documents</h3>
        <p className="text-xs text-muted-foreground">Find documents by title and generate memories</p>
      </div>

      {/* Source toggle */}
      {showToggle && (
        <div className="flex gap-1 p-1 bg-secondary/50 rounded-xl">
          {availableSources.map((source) => {
            const cfg = sourceConfig[source];
            const isActive = source === activeSource;
            const Icon = cfg.icon;
            return (
              <button
                key={source}
                onClick={() => handleSourceChange(source)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {cfg.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by title..."
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-10 h-11 rounded-xl bg-secondary/50 border-0"
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={isSearching || !query.trim()}
          style={{ backgroundColor: activeCfg.color }}
          className="h-11 px-5 rounded-xl text-white hover:opacity-90"
        >
          {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
        </Button>
      </div>

      {isSearching && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: activeCfg.color }} />
        </div>
      )}

      {!isSearching && hasSearched && searchResults.length === 0 && (
        <div className="text-center py-8">
          <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No documents found</p>
        </div>
      )}

      {!isSearching && searchResults.length > 0 && (
        <div className="space-y-2">
          {searchResults.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/30"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                {doc.createdTime && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(doc.createdTime).toLocaleDateString()}
                  </p>
                )}
              </div>
              {doc.alreadySaved ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2.5 py-1.5 rounded-lg shrink-0">
                  <Check className="w-3.5 h-3.5" />
                  Saved
                </span>
              ) : (
                <Button
                  size="sm"
                  onClick={() => onGenerate(doc.id, doc.name)}
                  disabled={isSaving[doc.id]}
                  style={{ backgroundColor: activeCfg.color }}
                  className="text-white rounded-lg shrink-0 hover:opacity-90"
                >
                  {isSaving[doc.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Generate"}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
