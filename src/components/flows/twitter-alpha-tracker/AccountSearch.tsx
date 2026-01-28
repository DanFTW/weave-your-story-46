import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Search, Loader2, Twitter, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { TrackedTwitterAccount } from "@/types/twitterAlphaTracker";
import { cn } from "@/lib/utils";

interface AccountSearchProps {
  onSearch: (query: string) => void;
  onSelect: (account: TrackedTwitterAccount) => void;
  searchResults: TrackedTwitterAccount[];
  isSearching: boolean;
}

export function AccountSearch({
  onSearch,
  onSelect,
  searchResults,
  isSearching,
}: AccountSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const handleSearch = useCallback(() => {
    if (query.trim()) {
      onSearch(query.trim().replace(/^@/, ""));
    }
  }, [query, onSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      {/* Header */}
      <div className="relative px-5 pt-status-bar pb-6 thread-gradient-blue">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/threads")}
            className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>

          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">
              Twitter Alpha Tracker
            </h1>
            <p className="text-white/70 text-sm truncate">
              Select an account to track
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-5 pt-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by username..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10"
            />
          </div>
          <Button onClick={handleSearch} disabled={isSearching || !query.trim()}>
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Search"
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          Enter a Twitter username to find the account you want to track
        </p>
      </div>

      {/* Results */}
      <div className="px-5 pt-6 space-y-3">
        {searchResults.map((account) => (
          <button
            key={account.userId}
            onClick={() => onSelect(account)}
            className={cn(
              "w-full p-4 rounded-xl border border-border bg-card",
              "flex items-center gap-3 text-left",
              "transition-all duration-200",
              "hover:border-primary/50 hover:bg-accent/50"
            )}
          >
            <Avatar className="w-12 h-12">
              {account.avatarUrl ? (
                <AvatarImage src={account.avatarUrl} alt={account.displayName} />
              ) : null}
              <AvatarFallback>
                <User className="w-5 h-5 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">
                {account.displayName || account.username}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                @{account.username}
              </p>
            </div>

            <Twitter className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          </button>
        ))}

        {searchResults.length === 0 && query && !isSearching && (
          <div className="text-center py-8">
            <User className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">No results found</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Try a different username
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
