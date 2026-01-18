import { Camera, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface SyncingScreenProps {
  message?: string;
}

export function SyncingScreen({ message = "Syncing your photos..." }: SyncingScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
      {/* Animated Icon */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="relative mb-8"
      >
        {/* Outer pulse ring */}
        <motion.div
          animate={{ 
            scale: [1, 1.3, 1],
            opacity: [0.3, 0, 0.3],
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute inset-0 rounded-full bg-teal-500/30"
        />
        
        {/* Inner pulse ring */}
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.5, 0.1, 0.5],
          }}
          transition={{ 
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.3,
          }}
          className="absolute inset-0 rounded-full bg-teal-500/40"
        />

        {/* Main icon container */}
        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
          <Camera className="w-10 h-10 text-white" />
        </div>
      </motion.div>

      {/* Loading Spinner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-3 mb-4"
      >
        <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
        <span className="text-base font-medium text-foreground">{message}</span>
      </motion.div>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-sm text-muted-foreground text-center max-w-xs"
      >
        We're scanning your recent photos and creating memories. This may take a moment.
      </motion.p>

      {/* Progress dots animation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex gap-2 mt-8"
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2,
            }}
            className="w-2 h-2 rounded-full bg-teal-500"
          />
        ))}
      </motion.div>
    </div>
  );
}
