import { CheckCircle2, Globe, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface WebsiteScrapeSuccessProps {
  memoryCount: number;
  url: string;
  onScrapeAnother: () => void;
  onDone: () => void;
}

export function WebsiteScrapeSuccess({ memoryCount, url, onScrapeAnother, onDone }: WebsiteScrapeSuccessProps) {
  let displayUrl = url;
  try {
    displayUrl = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
  } catch { /* keep original */ }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <CheckCircle2 className="w-10 h-10 text-primary" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex flex-col items-center gap-2 mb-8"
      >
        <h1 className="text-2xl font-bold text-foreground text-center">
          {memoryCount} {memoryCount === 1 ? 'Memory' : 'Memories'} Saved!
        </h1>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Globe className="w-3.5 h-3.5" />
          <span>{displayUrl}</span>
        </div>
      </motion.div>

      <div className="w-full max-w-sm flex flex-col gap-3">
        <Button
          onClick={onScrapeAnother}
          className="w-full h-14 text-base font-semibold rounded-2xl gap-2"
        >
          Scrape Another
          <ArrowRight className="w-5 h-5" />
        </Button>

        <Button
          variant="outline"
          onClick={onDone}
          className="w-full h-14 text-base font-semibold rounded-2xl"
        >
          Done
        </Button>
      </div>
    </div>
  );
}
