import { Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface QuickMemoryFABProps {
  onClick: () => void;
}

/**
 * Floating Action Button for quickly adding memories
 * Positioned above the bottom navigation
 */
export function QuickMemoryFAB({ onClick }: QuickMemoryFABProps) {
  return (
    <motion.div
      className="fixed bottom-24 right-5 z-40"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.2 }}
    >
      <Button
        onClick={onClick}
        size="icon"
        className="h-14 w-14 rounded-full bg-primary shadow-lg hover:bg-primary/90 hover:shadow-xl transition-shadow"
        asChild
      >
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Plus className="h-6 w-6" />
          <span className="sr-only">Add quick memory</span>
        </motion.button>
      </Button>
    </motion.div>
  );
}
