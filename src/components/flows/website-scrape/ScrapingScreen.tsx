import { Loader2, Globe } from "lucide-react";
import { motion } from "framer-motion";
import { WebsiteScrapePhase } from "@/types/websiteScrape";

interface ScrapingScreenProps {
  phase: Extract<WebsiteScrapePhase, 'scraping' | 'generating'>;
}

export function ScrapingScreen({ phase }: ScrapingScreenProps) {
  const isScraping = phase === 'scraping';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 thread-gradient-teal">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center text-center"
      >
        {/* Icon */}
        <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-6">
          <Globe className="w-10 h-10 text-white" strokeWidth={1.5} />
        </div>

        {/* Loading spinner */}
        <div className="mb-6">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>

        {/* Text */}
        <h1 className="text-2xl font-bold text-white mb-2">
          {isScraping ? 'Reading the page' : 'Extracting Memories'}
        </h1>
        <p className="text-white/80 text-base">
          {isScraping
            ? 'Fetching and parsing the website content...'
            : 'Our AI is identifying key facts and insights...'}
        </p>
      </motion.div>
    </div>
  );
}
