import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

function FacebookLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} fill="url(#fb-sync-grad)">
      <defs>
        <linearGradient x1="50%" x2="50%" y1="97.078%" y2="0%" id="fb-sync-grad">
          <stop offset="0%" stopColor="#0062E0"/>
          <stop offset="100%" stopColor="#19AFFF"/>
        </linearGradient>
      </defs>
      <path d="M15 35.8C6.5 34.3 0 26.9 0 18 0 8.1 8.1 0 18 0s18 8.1 18 18c0 8.9-6.5 16.3-15 17.8l-1-.8h-4l-1 .8z"/>
      <path fill="#fff" d="M25 23l.8-5H21v-3.5c0-1.4.5-2.5 2.7-2.5H26V7.4c-1.3-.2-2.7-.4-4-.4-4.1 0-7 2.5-7 7v4h-4.5v5H15v12.7c1 .2 2 .3 3 .3s2-.1 3-.3V23h4z"/>
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
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#1877F2] to-[#0062E0] flex items-center justify-center">
          <FacebookLogo className="w-14 h-14" />
        </div>
        <motion.div
          className="absolute inset-0 rounded-full border-4 border-[#1877F2]"
          animate={{ scale: [1, 1.3, 1.3], opacity: [0.8, 0, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
        />
      </motion.div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-[#1877F2]" />
        <h3 className="text-lg font-semibold">Importing Facebook Posts</h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Fetching your posts and creating memories. This may take a moment...
        </p>
      </div>

      <div className="mt-8 space-y-2 text-center">
        <motion.p
          className="text-sm text-muted-foreground"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          Creating memories from your posts...
        </motion.p>
      </div>
    </div>
  );
}
