import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Search, Loader2, Twitter, User, X, Check, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { TrackedTwitterAccount, TrackedTwitterAccountWithStats } from "@/types/twitterAlphaTracker";
import { cn } from "@/lib/utils";

interface AccountSearchProps {
  onSearch: (query: string) => void;
  onAddAccount: (account: TrackedTwitterAccount) => void;
  onRemoveAccount: (username: string) => void;
  onConfirm: () => void;
  searchResults: TrackedTwitterAccount[];
  selectedAccounts: TrackedTwitterAccount[];
  existingAccounts: TrackedTwitterAccountWithStats[];
  isSearching: boolean;
  isConfirming: boolean;
}

export function AccountSearch({
  onSearch,
  onAddAccount,
  onRemoveAccount,
  onConfirm,
  searchResults,
  selectedAccounts,
  existingAccounts,
  isSearching,
  isConfirming,
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

  const isAccountSelected = (username: string) =>
    selectedAccounts.some((a) => a.username === username);

  const isAccountExisting = (username: string) =>
    existingAccounts.some((a) => a.username === username);

  const totalNewSelected = selectedAccounts.filter(
    (a) => !isAccountExisting(a.username)
  ).length;

  const allAccountsCount = existingAccounts.length + totalNewSelected;

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
              Select accounts to track
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
          Search and add multiple Twitter accounts to track
        </p>
      </div>

      {/* Selected Accounts */}
      {selectedAccounts.length > 0 && (
        <div className="px-5 pt-4">
          <p className="text-sm font-medium text-foreground mb-2">
            Selected ({selectedAccounts.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedAccounts.map((account) => (
              <div
                key={account.username}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full",
                  "bg-primary/10 border border-primary/20"
                )}
              >
                <Avatar className="w-5 h-5">
                  {account.avatarUrl ? (
                    <AvatarImage src={account.avatarUrl} alt={account.displayName} />
                  ) : null}
                  <AvatarFallback className="text-xs">
                    <User className="w-3 h-3" />
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">@{account.username}</span>
                <button
                  onClick={() => onRemoveAccount(account.username)}
                  className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary/30"
                >
                  <X className="w-3 h-3 text-primary" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Existing Tracked Accounts */}
      {existingAccounts.length > 0 && (
        <div className="px-5 pt-4">
          <p className="text-sm font-medium text-muted-foreground mb-2">
            Already tracking ({existingAccounts.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {existingAccounts.map((account) => (
              <div
                key={account.username}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full",
                  "bg-muted/50 border border-border"
                )}
              >
                <Avatar className="w-5 h-5">
                  {account.avatarUrl ? (
                    <AvatarImage src={account.avatarUrl} alt={account.displayName} />
                  ) : null}
                  <AvatarFallback className="text-xs">
                    <User className="w-3 h-3" />
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground">@{account.username}</span>
                <Check className="w-3 h-3 text-muted-foreground" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search Results */}
      <div className="px-5 pt-6 space-y-3">
        {searchResults.map((account) => {
          const selected = isAccountSelected(account.username);
          const existing = isAccountExisting(account.username);

          return (
            <button
              key={account.userId}
              onClick={() => !existing && !selected && onAddAccount(account)}
              disabled={existing || selected}
              className={cn(
                "w-full p-4 rounded-xl border bg-card",
                "flex items-center gap-3 text-left",
                "transition-all duration-200",
                existing || selected
                  ? "border-primary/50 bg-primary/5 cursor-default"
                  : "border-border hover:border-primary/50 hover:bg-accent/50"
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

              {existing ? (
                <Check className="w-5 h-5 text-primary flex-shrink-0" />
              ) : selected ? (
                <Check className="w-5 h-5 text-primary flex-shrink-0" />
              ) : (
                <Plus className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              )}
            </button>
          );
        })}

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

      {/* Continue Button */}
      {(selectedAccounts.length > 0 || existingAccounts.length > 0) && (
        <div className="fixed bottom-nav left-0 right-0 p-5 bg-background border-t border-border">
          <Button
            onClick={onConfirm}
            disabled={isConfirming || (selectedAccounts.length === 0 && existingAccounts.length === 0)}
            className="w-full h-12 text-base thread-gradient-blue border-0 hover:opacity-90"
          >
            {isConfirming ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : null}
            {selectedAccounts.length > 0
              ? `Continue with ${allAccountsCount} account${allAccountsCount > 1 ? "s" : ""}`
              : `Continue with ${existingAccounts.length} account${existingAccounts.length > 1 ? "s" : ""}`}
          </Button>
        </div>
      )}
    </div>
  );
}
