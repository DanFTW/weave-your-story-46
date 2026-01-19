import { Instagram, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export function SyncingScreen() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <motion.div
        className="relative"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
          <Instagram className="w-12 h-12 text-white" />
        </div>
        <motion.div
          className="absolute inset-0 rounded-full border-4 border-pink-400"
          animate={{ scale: [1, 1.3, 1.3], opacity: [0.8, 0, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
        />
      </motion.div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
        <h3 className="text-lg font-semibold">Syncing Instagram</h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Fetching your posts and comments. This may take a moment...
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
