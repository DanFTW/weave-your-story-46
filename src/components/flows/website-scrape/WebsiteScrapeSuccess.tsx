import { motion } from "framer-motion";
import { CheckCircle2, Globe, ArrowRight } from "lucide-react";

interface WebsiteScrapeSuccessProps {
  memoryCount: number;
  url: string;
  onScrapeAnother: () => void;
  onDone: () => void;
}

export function WebsiteScrapeSuccess({ memoryCount, url, onScrapeAnother, onDone }: WebsiteScrapeSuccessProps) {
  // Show a truncated domain for display
  let displayUrl = url;
  try {
    displayUrl = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
  } catch { /* keep original */ }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", duration: 0.6 }}
        className="mb-6"
      >
        <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex flex-col items-center gap-2 mb-2"
      >
        <h3 className="text-xl font-bold text-foreground">
          {memoryCount} {memoryCount === 1 ? 'memory' : 'memories'} saved
        </h3>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Globe className="w-3.5 h-3.5" />
          <span>{displayUrl}</span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="w-full mt-auto pb-8 flex flex-col gap-3"
      >
        <button
          onClick={onScrapeAnother}
          className="w-full h-[52px] rounded-[18px] font-bold text-base text-white"
          style={{
            padding: '2px',
            background: 'radial-gradient(ellipse 108.65% 103.45% at 50.00% 109.62%, #FF543E 0%, #1050C5 60%)',
          }}
        >
          <div
            className="w-full h-full rounded-[16px] flex items-center justify-center gap-2"
            style={{
              background: 'radial-gradient(ellipse 100.00% 52.73% at 50.00% 0.00%, #1074C5 0%, rgba(16, 79, 197, 0.50) 100%)',
            }}
          >
            <span>Scrape Another</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </button>

        <button
          onClick={onDone}
          className="w-full h-[52px] rounded-[18px] bg-[#909AAB] font-bold text-base text-white flex items-center justify-center"
          style={{ padding: '2px' }}
        >
          <div className="w-full h-full rounded-[16px] bg-[#909AAB] flex items-center justify-center">
            Done
          </div>
        </button>
      </motion.div>
    </div>
  );
}
