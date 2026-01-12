import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { ThreadCard } from "@/components/ThreadCard";
import { sampleThreads } from "@/data/threads";
import { Thread } from "@/types/threads";

export default function Threads() {
  const navigate = useNavigate();

  const handleThreadClick = (thread: Thread) => {
    navigate(`/thread/${thread.id}`);
  };

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
    </div>
  );
}
