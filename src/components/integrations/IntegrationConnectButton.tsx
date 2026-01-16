import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface IntegrationConnectButtonProps {
  onClick?: () => void;
  isConnected?: boolean;
  className?: string;
}

export function IntegrationConnectButton({ 
  onClick, 
  isConnected = false,
  className 
}: IntegrationConnectButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "relative w-full py-4 rounded-full font-medium text-base overflow-hidden",
        "bg-[#3B5BDB] text-white",
        "shadow-lg shadow-[#3B5BDB]/25",
        "active:shadow-md transition-shadow duration-200",
        className
      )}
    >
      {/* Subtle orange/warm glow in center */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 50% 80% at 50% 50%, rgba(255, 160, 80, 0.25) 0%, transparent 60%)",
        }}
      />
      
      {/* Button text */}
      <span className="relative z-10">
        {isConnected ? "Connected" : "Connect your account"}
      </span>
    </motion.button>
  );
}
