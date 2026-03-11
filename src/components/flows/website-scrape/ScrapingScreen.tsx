import { motion } from "framer-motion";
import { Globe, Loader2 } from "lucide-react";
import { WebsiteScrapePhase } from "@/types/websiteScrape";

interface ScrapingScreenProps {
  phase: Extract<WebsiteScrapePhase, 'scraping' | 'generating'>;
}

export function ScrapingScreen({ phase }: ScrapingScreenProps) {
  const isScraping = phase === 'scraping';

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <motion.div
        className="relative mb-8"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Pulsing ring */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-accent/30"
          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          style={{ width: 80, height: 80, top: -8, left: -8 }}
        />
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
          <Globe className="w-8 h-8 text-accent" />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex flex-col items-center gap-3"
      >
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <h3 className="text-lg font-bold text-foreground">
          {isScraping ? 'Reading the page...' : 'Extracting memories...'}
        </h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          {isScraping
            ? 'Fetching and parsing the website content'
            : 'Our AI is identifying key facts and insights'}
        </p>
      </motion.div>
    </div>
  );
}
