import { useState } from "react";
import { Globe, ClipboardPaste, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface WebsiteUrlInputProps {
  onSubmit: (url: string) => void;
}

export function WebsiteUrlInput({ onSubmit }: WebsiteUrlInputProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const validateUrl = (value: string): boolean => {
    if (!value.trim()) {
      setError("Please enter a URL");
      return false;
    }
    try {
      const formatted = value.startsWith('http') ? value : `https://${value}`;
      new URL(formatted);
      setError("");
      return true;
    } catch {
      setError("Please enter a valid URL");
      return false;
    }
  };

  const handleSubmit = () => {
    if (validateUrl(url)) {
      onSubmit(url.trim());
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        setError("");
      }
    } catch {
      // Clipboard API not available
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex flex-col px-5 pt-8"
    >
      {/* Illustration */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Globe className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground text-center mb-2">
          Paste a website link
        </h2>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          We'll extract key facts, insights, and data from the page and turn them into memories.
        </p>
      </div>

      {/* URL Input */}
      <div className="flex flex-col gap-3 mb-6">
        <label className="text-sm font-medium text-muted-foreground">Website URL</label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(""); }}
              onKeyDown={handleKeyDown}
              placeholder="https://example.com"
              className="w-full h-[52px] px-4 bg-muted/50 rounded-[20px] text-foreground placeholder:text-muted-foreground/40 text-base font-medium outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              autoFocus
            />
          </div>
          <button
            onClick={handlePaste}
            className="h-[52px] w-[52px] rounded-[20px] bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
            title="Paste from clipboard"
          >
            <ClipboardPaste className="w-5 h-5" />
          </button>
        </div>
        {error && (
          <p className="text-xs text-destructive pl-1">{error}</p>
        )}
      </div>

      {/* Submit Button */}
      <div className="mt-auto pb-8">
        <Button
          onClick={handleSubmit}
          disabled={!url.trim()}
          className="w-full h-14 text-base font-semibold rounded-2xl gap-2"
        >
          Extract Memories
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </motion.div>
  );
}
