import { motion } from "framer-motion";
import { PageHeader } from "@/components/PageHeader";
import { ThreadCard } from "@/components/ThreadCard";
import { BottomNav } from "@/components/BottomNav";
import { sampleThreads } from "@/data/threads";
import { Thread } from "@/types/threads";
import { toast } from "sonner";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

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
    <div className="min-h-screen bg-background pb-nav">
      <div className="px-5 pt-14">
        <PageHeader 
          title="Threads" 
          subtitle="Create memories through automated connections" 
        />

        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="mt-6 grid grid-cols-2 gap-3"
        >
          {sampleThreads.map((thread) => (
            <motion.div key={thread.id} variants={item}>
              <ThreadCard
                thread={thread}
                onClick={() => handleThreadClick(thread)}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
}
