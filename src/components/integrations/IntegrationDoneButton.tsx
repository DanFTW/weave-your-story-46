import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface IntegrationDoneButtonProps {
  onClick?: () => void;
  className?: string;
}

export function IntegrationDoneButton({ onClick, className }: IntegrationDoneButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "w-full py-4 rounded-full font-medium text-base",
        "bg-[#3B5BDB] text-white",
        "shadow-lg shadow-[#3B5BDB]/25",
        "active:shadow-md transition-shadow duration-200",
        className
      )}
    >
      Done
    </motion.button>
  );
}
