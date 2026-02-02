import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { QuickMemoryFAB } from "@/components/home/QuickMemoryFAB";
import { QuickMemoryDrawer } from "@/components/home/QuickMemoryDrawer";
import { useLiamMemory } from "@/hooks/useLiamMemory";
import { ThreadCard } from "@/components/ThreadCard";
import { MemoryCard } from "@/components/memories/MemoryCard";
import { sampleThreads } from "@/data/threads";
import { Memory } from "@/types/memory";

export default function Home() {
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [memories, setMemories] = useState<Memory[]>([]);
  const carouselRef = useRef<HTMLDivElement>(null);
  const { createMemory, isCreating, listMemories } = useLiamMemory();

  // Get pinned threads (showing first 10 for carousel)
  const pinnedThreads = sampleThreads.slice(0, 10);

  // Fetch recent memories on mount
  useEffect(() => {
    const fetchMemories = async () => {
      const data = await listMemories();
      if (data) {
        // Sort by createdAt descending and take first 3
        const sorted = [...data].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setMemories(sorted.slice(0, 3));
      }
    };
    fetchMemories();
  }, []);

  const handleSaveMemory = async (content: string, tag?: string) => {
    const success = await createMemory(content, tag || 'quick_note');
    if (success) {
      // Refresh memories after saving
      const data = await listMemories();
      if (data) {
        const sorted = [...data].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setMemories(sorted.slice(0, 3));
      }
    }
    return success;
  };

  const handleScroll = () => {
    if (carouselRef.current) {
      const scrollLeft = carouselRef.current.scrollLeft;
      const cardWidth = carouselRef.current.offsetWidth - 40; // Account for padding
      const newSlide = Math.round(scrollLeft / cardWidth);
      setCurrentSlide(newSlide);
    }
  };

  return (
    <div className="pb-nav">
      {/* Pinned Threads Section */}
      <div className="px-5 pt-safe-top">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="pb-4"
        >
          <h2 className="text-2xl font-bold text-foreground tracking-tight">
            Pinned Threads
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Swipe to explore flows and automations
          </p>
        </motion.div>
      </div>

      {/* Thread Carousel */}
      <div 
        ref={carouselRef}
        onScroll={handleScroll}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-5 pb-4 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {pinnedThreads.map((thread, index) => (
          <motion.div
            key={thread.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="flex-shrink-0 w-[calc(100%-40px)] snap-center"
          >
            <ThreadCard
              thread={thread}
              onClick={() => navigate(`/thread/${thread.id}`)}
              fixedHeight
            />
          </motion.div>
        ))}
      </div>

      {/* Carousel Dots */}
      <div className="flex justify-center gap-1.5 pb-6">
        {pinnedThreads.map((_, index) => (
          <div
            key={index}
            className={`h-2 rounded-full transition-all duration-200 ${
              index === currentSlide 
                ? 'w-4 bg-foreground' 
                : 'w-2 bg-muted-foreground/30'
            }`}
          />
        ))}
      </div>

      {/* Recent Memories Section */}
      <div className="px-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-foreground tracking-tight">
            Recent Memories
          </h2>
          <button
            onClick={() => navigate('/memories')}
            className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            See all
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Memory Cards */}
        <div className="space-y-3">
          {memories.length > 0 ? (
            memories.map((memory, index) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                index={index}
              />
            ))
          ) : (
            <div className="rounded-2xl bg-card p-6 border border-border/50 text-center">
              <p className="text-sm text-muted-foreground">
                No memories yet. Create your first memory!
              </p>
            </div>
          )}
        </div>
      </div>

      <QuickMemoryFAB onClick={() => setDrawerOpen(true)} />
      
      <QuickMemoryDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSave={handleSaveMemory}
        isSaving={isCreating}
      />
    </div>
  );
}
