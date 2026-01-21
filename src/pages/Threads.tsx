import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { ThreadCard } from "@/components/ThreadCard";
import { ThreadDetailSheet } from "@/components/threads/ThreadDetailSheet";
import { sampleThreads } from "@/data/threads";
import { getThreadConfig } from "@/data/threadConfigs";
import { Thread } from "@/types/threads";

// Threads that navigate directly to overview (no detail sheet)
const flowEnabledThreads = ['family', 'food-preferences', 'receipts', 'interests', 'llm-import', 'email-dump', 'email-automation', 'google-photos-sync', 'instagram-sync', 'instagram-live', 'twitter-sync', 'twitter-live', 'youtube-sync'];

export default function Threads() {
  const navigate = useNavigate();
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

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

        <div className="mt-6 space-y-3">
          {sampleThreads.map((thread) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              onClick={() => handleThreadClick(thread)}
            />
          ))}
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
