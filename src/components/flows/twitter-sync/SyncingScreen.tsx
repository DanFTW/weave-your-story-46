import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

// X logo component
function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function SyncingScreen() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <motion.div
        className="relative"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gray-800 to-black flex items-center justify-center">
          <XLogo className="w-12 h-12 text-white" />
        </div>
        <motion.div
          className="absolute inset-0 rounded-full border-4 border-gray-600"
          animate={{ scale: [1, 1.3, 1.3], opacity: [0.8, 0, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
        />
      </motion.div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
        <h3 className="text-lg font-semibold">Syncing Twitter</h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Fetching your tweets and activity. This may take a moment...
        </p>
      </div>

      <div className="mt-8 space-y-2 text-center">
        <motion.p
          className="text-sm text-muted-foreground"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          Creating memories from your content...
        </motion.p>
      </div>
    </div>
  );
}
