import { Plus, ChevronRight, Pencil } from "lucide-react";
import { FlowConfig, FlowEntry } from "@/types/flows";
import { ThreadSplash } from "@/components/thread/ThreadSplash";
import { motion } from "framer-motion";

interface FlowConfiguredProps {
  config: FlowConfig;
  entries: FlowEntry[];
  onAddEntry: () => void;
  onEditEntry: (entryId: string) => void;
  onViewMemories: (entryId: string) => void;
}

export function FlowConfigured({
  config,
  entries,
  onAddEntry,
  onEditEntry,
  onViewMemories,
}: FlowConfiguredProps) {
  const getEntryTitle = (entry: FlowEntry) => {
    const titleField = config.fields.find(f => f.type === 'text');
    return titleField ? entry.data[titleField.id] || 'Untitled' : 'Untitled';
  };

  const getEntrySubtitle = (entry: FlowEntry) => {
    const subtitleField = config.fields.find(f => f.type === 'select') || 
                          config.fields.filter(f => f.type === 'text')[1];
    return subtitleField ? entry.data[subtitleField.id] : '';
  };

  return (
    <div className="min-h-screen bg-background">
      <ThreadSplash
        title={config.title}
        icon={config.icon}
        gradient={config.gradient}
      />
      
      <div className="px-5 -mt-2 pb-8">
        {/* Success Message */}
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border mb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              Memories Saved
            </h2>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Your {config.entryNamePlural} have been added to your memory. You can update them anytime.
          </p>
        </div>

        {/* Entry Cards */}
        <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
          Your {config.entryNamePlural}
        </h3>
        
        <div className="space-y-3">
          {entries.map((entry, index) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden"
            >
              <div className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">
                    {getEntryTitle(entry)}
                  </h3>
                  {getEntrySubtitle(entry) && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {getEntrySubtitle(entry)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-3">
                  <button
                    onClick={() => onEditEntry(entry.id)}
                    className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => onViewMemories(entry.id)}
                    className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Add Another Card */}
          <motion.button
            onClick={onAddEntry}
            className="w-full bg-card rounded-2xl p-4 shadow-sm border border-border border-dashed flex items-center gap-3 hover:border-primary/30 transition-colors"
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Plus className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              Add another {config.entryName}
            </span>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
