import { useState, useEffect } from "react";
import { Search, X, Check, Loader2, ArrowRight, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Contact } from "@/types/emailDump";
import { cn } from "@/lib/utils";

interface ContactSearchProps {
  selectedEmails: string[];
  searchResults: Contact[];
  isSearching: boolean;
  onSearch: (query: string) => Promise<void>;
  onSelect: (email: string) => void;
  onDeselect: (email: string) => void;
  onClear: () => void;
  onContinue: () => void;
}

export function ContactSearch({
  selectedEmails,
  searchResults,
  isSearching,
  onSearch,
  onSelect,
  onDeselect,
  onClear,
  onContinue,
}: ContactSearchProps) {
  const [query, setQuery] = useState("");

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        onSearch(query);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, onSearch]);

  const handleEmailClick = (email: string) => {
    if (selectedEmails.includes(email)) {
      onDeselect(email);
    } else {
      onSelect(email);
    }
  };

  const handleAddManualEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(query) && !selectedEmails.includes(query)) {
      onSelect(query);
      setQuery("");
    }
  };

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query);
  const showAddButton = isValidEmail && !selectedEmails.includes(query);

  return (
    <div className="flex flex-col h-full">
      {/* Search Input */}
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email..."
          className="pl-12 pr-12 h-14 rounded-2xl text-base bg-muted/50 border-0"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Add Manual Email Button */}
      {showAddButton && (
        <Button
          variant="outline"
          onClick={handleAddManualEmail}
          className="mb-4 h-12 rounded-xl justify-start gap-3"
        >
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-4 h-4 text-primary" />
          </div>
          <span>Add "{query}"</span>
        </Button>
      )}

      {/* Selected Emails */}
      {selectedEmails.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-foreground">
              Selected ({selectedEmails.length})
            </p>
            <button
              onClick={onClear}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedEmails.map((email) => (
              <Badge
                key={email}
                variant="secondary"
                className="h-8 px-3 gap-2 rounded-full cursor-pointer hover:bg-muted"
                onClick={() => onDeselect(email)}
              >
                {email}
                <X className="w-3 h-3" />
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Search Results */}
      <div className="flex-1 overflow-y-auto">
        {isSearching && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isSearching && query.length >= 2 && searchResults.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              No contacts found. {isValidEmail && "You can add the email above."}
            </p>
          </div>
        )}

        {!isSearching && searchResults.length > 0 && (
          <div className="space-y-2">
            {searchResults.map((contact) => {
              const isSelected = selectedEmails.includes(contact.email);
              return (
                <button
                  key={contact.email}
                  onClick={() => handleEmailClick(contact.email)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl transition-colors",
                    isSelected 
                      ? "bg-primary/10 border-2 border-primary" 
                      : "bg-muted/50 hover:bg-muted"
                  )}
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={contact.avatarUrl} />
                    <AvatarFallback>
                      {contact.name?.[0] || contact.email[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    {contact.name && (
                      <p className="text-sm font-medium text-foreground">
                        {contact.name}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {contact.email}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {!isSearching && query.length < 2 && searchResults.length === 0 && selectedEmails.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Search for contacts to select
            </p>
          </div>
        )}
      </div>

      {/* Continue Button */}
      <div className="pt-4 pb-safe">
        <Button
          onClick={onContinue}
          disabled={selectedEmails.length === 0}
          className="w-full h-14 text-base font-semibold rounded-2xl gap-2"
        >
          Select Contacts ({selectedEmails.length})
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
