import { useState } from "react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/PageHeader";
import { ThreadCard } from "@/components/ThreadCard";
import { BottomNav, NavItem } from "@/components/BottomNav";
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
  const [activeNav, setActiveNav] = useState<NavItem>("threads");

  const handleThreadClick = (thread: Thread) => {
    if (thread.status === "setup") {
      toast.info(`Setting up ${thread.title}...`);
    } else if (thread.status === "active") {
      toast.success(`Viewing ${thread.title}`);
    } else {
      toast.info(`Try: ${thread.title}`);
    }
  };

  const handleNavClick = (navItem: NavItem) => {
    setActiveNav(navItem);
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <PageHeader title="Threads" />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="px-4 space-y-4"
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

      <BottomNav activeItem={activeNav} onItemClick={handleNavClick} />
    </div>
  );
}
