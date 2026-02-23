import { motion } from "framer-motion";
import { Link2, User, Instagram, Twitter, Youtube, Mail, MessageSquare, FileText, Mic, Globe, Lock, Globe2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SharedMemoryItem } from "@/types/memory";
import { cn } from "@/lib/utils";

interface SharedWithMeListProps {
  items: SharedMemoryItem[];
  isLoading: boolean;
  activeFilter: string;
}

const tagConfig: Record<string, { label: string; icon: React.ElementType; gradient: string }> = {
  INSTAGRAM: { label: 'Instagram', icon: Instagram, gradient: 'from-pink-500 to-fuchsia-600' },
  TWITTER: { label: 'X / Twitter', icon: Twitter, gradient: 'from-sky-500 to-blue-600' },
  YOUTUBE: { label: 'YouTube', icon: Youtube, gradient: 'from-red-500 to-rose-600' },
  GMAIL: { label: 'Gmail', icon: Mail, gradient: 'from-amber-400 to-orange-500' },
  DISCORD: { label: 'Discord', icon: MessageSquare, gradient: 'from-indigo-500 to-violet-600' },
  GOOGLE_DRIVE: { label: 'Google Drive', icon: FileText, gradient: 'from-emerald-400 to-teal-500' },
  LINKEDIN: { label: 'LinkedIn', icon: Globe, gradient: 'from-blue-500 to-blue-700' },
  FIREFLIES: { label: 'Fireflies', icon: Mic, gradient: 'from-purple-500 to-pink-500' },
};

function getTagInfo(item: SharedMemoryItem) {
  const tag = (item.memoryTag ?? item.threadTag ?? '').toUpperCase();
  return tagConfig[tag] ?? null;
}

function scopeLabel(item: SharedMemoryItem): string {
  if (item.shareScope === 'thread' && item.threadTag) {
    return `All memories from ${item.threadTag}`;
  }
  if (item.shareScope === 'custom' && item.customCondition) {
    return `Custom: ${item.customCondition}`;
  }
  return 'Single memory';
}

function cardGradient(item: SharedMemoryItem): string {
  const tag = (item.memoryTag ?? item.threadTag ?? '').toUpperCase();
  const gradients: Record<string, string> = {
    TWITTER: 'from-sky-500 to-blue-600',
    INSTAGRAM: 'from-pink-500 to-fuchsia-600',
    YOUTUBE: 'from-red-500 to-rose-600',
    GMAIL: 'from-amber-400 to-orange-500',
    DISCORD: 'from-indigo-500 to-violet-600',
    GOOGLE_DRIVE: 'from-emerald-400 to-teal-500',
    LINKEDIN: 'from-blue-500 to-blue-700',
    FIREFLIES: 'from-purple-500 to-pink-500',
  };
  return gradients[tag] ?? 'from-violet-500 to-purple-600';
}

function SharedCard({ item, index }: { item: SharedMemoryItem; index: number }) {
  const navigate = useNavigate();
  const sharer = item.ownerName ?? item.ownerEmail ?? 'Someone';
  const gradient = cardGradient(item);
  const tagInfo = getTagInfo(item);
  const when = new Date(item.sharedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      onClick={() => navigate(`/shared/${item.shareToken}`)}
      className="cursor-pointer rounded-2xl overflow-hidden bg-card border border-border/50 shadow-sm active:scale-[0.98] transition-transform"
    >
      {/* Gradient header */}
      <div className={cn("bg-gradient-to-br h-14 flex items-center justify-between px-4", gradient)}>
        <div className="flex items-center gap-2 min-w-0">
          <User className="h-4 w-4 text-white/80 shrink-0" />
          <span className="text-white text-sm font-medium truncate">
            {sharer}
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-white/20 rounded-full px-2.5 py-1 shrink-0">
          <Link2 className="h-3 w-3 text-white" />
          <span className="text-white text-xs font-medium">Shared</span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-2.5">
        <div className="flex items-center gap-2">
          <p className="text-foreground text-sm font-medium leading-snug">
            {scopeLabel(item)}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Shared {when}</span>
            {tagInfo && (
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white bg-gradient-to-r",
                tagInfo.gradient
              )}>
                <tagInfo.icon className="h-2.5 w-2.5" />
                {tagInfo.label}
              </span>
            )}
          </div>
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
            item.visibility === 'recipients_only'
              ? "bg-amber-500/15 text-amber-600"
              : "bg-emerald-500/15 text-emerald-600"
          )}>
            {item.visibility === 'recipients_only' ? (
              <><Lock className="h-2.5 w-2.5" /> Gated</>
            ) : (
              <><Globe2 className="h-2.5 w-2.5" /> Open</>
            )}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export function SharedWithMeList({ items, isLoading, activeFilter }: SharedWithMeListProps) {
  // Filter by tag if active filter is set
  const filtered = activeFilter === 'all'
    ? items
    : items.filter((item) =>
        item.threadTag?.toLowerCase() === activeFilter.toLowerCase()
      );

  if (isLoading) {
    return (
      <div className="space-y-3 mt-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl overflow-hidden bg-card border border-border/50 animate-pulse">
            <div className="h-14 bg-muted" />
            <div className="p-4 space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-20 text-center"
      >
        <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-4">
          <Link2 className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-foreground font-semibold text-base mb-1">
          No shared memories yet
        </h3>
        <p className="text-muted-foreground text-sm max-w-xs">
          When someone shares a memory with you, it will appear here.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3 mt-2">
      {filtered.map((item, i) => (
        <SharedCard key={item.shareId} item={item} index={i} />
      ))}
    </div>
  );
}
