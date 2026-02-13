import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/PageHeader";
import { ThreadCard } from "@/components/ThreadCard";
import { ThreadDetailSheet } from "@/components/threads/ThreadDetailSheet";
import { ThreadFilterBar } from "@/components/threads/ThreadFilterBar";
import { sampleThreads } from "@/data/threads";
import { getThreadConfig } from "@/data/threadConfigs";
import { Thread } from "@/types/threads";

// Threads that navigate directly to overview (no detail sheet)
const flowEnabledThreads = [
  'family', 'food-preferences', 'receipts', 'interests', 'llm-import', 
  'email-dump', 'email-automation', 'google-photos-sync', 'instagram-sync', 
  'instagram-live', 'twitter-sync', 'twitter-live', 'youtube-sync', 
  'linkedin-live', 'trello-tracker', 'hubspot-tracker', 'twitter-alpha-tracker',
  'todoist-task-tracker', 'fireflies-tracker', 'googledrive-tracker', 'discord-tracker'
];

type FlowModeFilter = "all" | "thread" | "flow" | "dump";

export default function Threads() {
  const navigate = useNavigate();
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [flowModeFilter, setFlowModeFilter] = useState<FlowModeFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredThreads = useMemo(() => {
    return sampleThreads.filter((thread) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = thread.title.toLowerCase().includes(query);
        const matchesDescription = thread.description?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDescription) {
          return false;
        }
      }
      // Flow mode filter
      if (flowModeFilter !== "all" && thread.flowMode !== flowModeFilter) {
        return false;
      }
      return true;
    });
  }, [flowModeFilter, searchQuery]);

  const handleThreadClick = (thread: Thread) => {
    // For flow-enabled threads, go directly to overview
    if (flowEnabledThreads.includes(thread.id)) {
      navigate(`/thread/${thread.id}`);
    } else {
      // For other threads (automations, etc.), show detail sheet
      setSelectedThread(thread);
      setSheetOpen(true);
    }
  };

  const handleGetStarted = () => {
    if (selectedThread) {
      setSheetOpen(false);
      navigate(`/thread/${selectedThread.id}`);
    }
  };

  const selectedConfig = selectedThread ? getThreadConfig(selectedThread.id) : null;

  return (
    <div className="pb-nav">
      <div className="px-5">
        <PageHeader 
          title="Threads" 
          subtitle="Create memories through automated connections" 
        />

        {/* Filter Bar */}
        <div className="mt-4 mb-6">
          <ThreadFilterBar
            flowModeFilter={flowModeFilter}
            searchQuery={searchQuery}
            onFlowModeChange={setFlowModeFilter}
            onSearchChange={setSearchQuery}
          />
        </div>

        {/* Thread Cards */}
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredThreads.map((thread) => (
              <motion.div
                key={thread.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <ThreadCard
                  thread={thread}
                  onClick={() => handleThreadClick(thread)}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredThreads.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 text-muted-foreground"
            >
              <p>No threads match your filters</p>
            </motion.div>
          )}
        </div>
      </div>

      <ThreadDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        thread={selectedThread}
        config={selectedConfig}
        onGetStarted={handleGetStarted}
      />
    </div>
  );
}
