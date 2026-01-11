import { useState, useRef } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Copy, Check, ChevronRight } from "lucide-react";

interface SwipeToUnlockProps {
  mcpUrl: string;
}

export function SwipeToUnlock({ mcpUrl }: SwipeToUnlockProps) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [copied, setCopied] = useState(false);
  const constraintsRef = useRef<HTMLDivElement>(null);
  
  const x = useMotionValue(0);
  const trackWidth = 280; // Total track width minus button width
  const unlockThreshold = trackWidth - 56; // 56px is button width
  
  const buttonOpacity = useTransform(x, [0, unlockThreshold * 0.5], [1, 0.3]);
  const textOpacity = useTransform(x, [0, unlockThreshold * 0.3], [1, 0]);
  const successOpacity = useTransform(x, [unlockThreshold * 0.7, unlockThreshold], [0, 1]);

  const handleDragEnd = () => {
    if (x.get() >= unlockThreshold) {
      animate(x, unlockThreshold, { duration: 0.2 });
      setIsUnlocked(true);
    } else {
      animate(x, 0, { duration: 0.3, type: "spring", stiffness: 400, damping: 30 });
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(mcpUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    animate(x, 0, { duration: 0.3, type: "spring", stiffness: 400, damping: 30 });
    setIsUnlocked(false);
  };

  return (
    <div className="space-y-3">
      {/* Swipe Track Card */}
      <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/50">
        <div 
          ref={constraintsRef}
          className="relative h-14 bg-muted rounded-xl overflow-hidden"
        >
          {/* Shimmer effect background */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.div 
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              animate={{ x: ["-100%", "200%"] }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              style={{ opacity: isUnlocked ? 0 : 1 }}
            />
          </div>

          {/* Text label */}
          <motion.div 
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ opacity: textOpacity }}
          >
            <div className="flex items-center gap-2 text-muted-foreground text-[15px] font-medium">
              <span>Swipe to reveal MCP URL</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </motion.div>

          {/* Success text */}
          <motion.div 
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ opacity: successOpacity }}
          >
            <span className="text-primary text-[15px] font-medium">Unlocked</span>
          </motion.div>

          {/* Draggable button */}
          <motion.button
            drag="x"
            dragConstraints={{ left: 0, right: unlockThreshold }}
            dragElastic={0}
            onDragEnd={handleDragEnd}
            style={{ x, opacity: buttonOpacity }}
            className="absolute left-1 top-1 bottom-1 w-12 bg-primary rounded-lg flex items-center justify-center cursor-grab active:cursor-grabbing shadow-md"
            whileTap={{ scale: 0.95 }}
            disabled={isUnlocked}
          >
            <ChevronRight className="w-5 h-5 text-primary-foreground" />
          </motion.button>
        </div>
      </div>

      {/* MCP URL Tray */}
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ 
          height: isUnlocked ? "auto" : 0, 
          opacity: isUnlocked ? 1 : 0 
        }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="overflow-hidden"
      >
        <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-muted-foreground uppercase tracking-wide">
              MCP URL for Claude
            </span>
            <button 
              onClick={handleReset}
              className="text-[13px] font-medium text-primary"
            >
              Lock
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-muted rounded-xl px-4 py-3 overflow-hidden">
              <p className="text-[15px] font-medium text-foreground truncate font-mono">
                {mcpUrl}
              </p>
            </div>
            <button
              onClick={handleCopy}
              className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center flex-shrink-0 transition-transform active:scale-95"
            >
              {copied ? (
                <Check className="w-5 h-5 text-primary-foreground" />
              ) : (
                <Copy className="w-5 h-5 text-primary-foreground" />
              )}
            </button>
          </div>
          
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Use this URL in Claude Desktop to connect your memories via MCP.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
