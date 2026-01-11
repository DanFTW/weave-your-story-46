import { PageHeader } from "@/components/PageHeader";
import { ThreadCard } from "@/components/ThreadCard";
import { sampleThreads } from "@/data/threads";
import { Thread } from "@/types/threads";
import { toast } from "sonner";

export default function Threads() {
  const handleThreadClick = (thread: Thread) => {
    if (thread.status === "setup") {
      toast.info(`Setting up ${thread.title}...`);
    } else if (thread.status === "active") {
      toast.success(`Viewing ${thread.title}`);
    } else {
      toast.info(`Try: ${thread.title}`);
    }
  };

  return (
    <div className="pb-nav">
      <div className="px-5 pt-14">
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
    </div>
  );
}
