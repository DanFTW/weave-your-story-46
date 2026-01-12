import { useState } from "react";
import { Plus, ChevronDown, ChevronUp, Pencil, Check } from "lucide-react";
import { FlowConfig, FlowEntry, GeneratedMemory } from "@/types/flows";
import { ThreadGradient } from "@/types/threads";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface FlowConfiguredProps {
  config: FlowConfig;
  entries: FlowEntry[];
  savedMemories: GeneratedMemory[];
  onAddEntry: () => void;
  onEditEntry: (entryId: string) => void;
}

const gradientClasses: Record<ThreadGradient, string> = {
  blue: "thread-gradient-blue",
  teal: "thread-gradient-teal",
  purple: "thread-gradient-purple",
  orange: "thread-gradient-orange",
  pink: "thread-gradient-pink",
};

export function FlowConfigured({
  config,
  entries,
  savedMemories,
  onAddEntry,
  onEditEntry,
}: FlowConfiguredProps) {
  const navigate = useNavigate();
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const isSingleEntry = config.singleEntry;

  const getEntryTitle = (entry: FlowEntry) => {
    const titleField = config.fields.find(f => f.type === 'text');
    return titleField ? entry.data[titleField.id] || 'Untitled' : 'Untitled';
  };

  const getEntrySubtitle = (entry: FlowEntry) => {
    const subtitleField = config.fields.find(f => f.type === 'select') || 
                          config.fields.filter(f => f.type === 'text')[1];
    return subtitleField ? entry.data[subtitleField.id] : '';
  };

  const getMemoriesForEntry = (entryId: string) => {
    return savedMemories.filter(m => m.entryId === entryId);
  };

  const toggleExpanded = (entryId: string) => {
    setExpandedEntryId(prev => prev === entryId ? null : entryId);
  };

  // For single-entry flows, parse and display array values
  const parseArrayValue = (value: string): string[] => {
    if (!value) return [];
    return value.split('|||').filter(v => v.trim());
  };

  const Icon = config.icon;

  // Render single-entry summary view
  const renderSingleEntrySummary = (entry: FlowEntry) => {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h3 className="font-semibold text-foreground">Your {config.entryName}</h3>
            <p className="text-sm text-muted-foreground">{savedMemories.length} memories saved</p>
          </div>
          <button
            onClick={() => onEditEntry(entry.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
        </div>
        
        {/* Summary Content */}
        <div className="p-4 space-y-4">
          {config.fields.map(field => {
            const value = entry.data[field.id];
            if (!value) return null;
            
            const isArrayField = field.type === 'multitext' || field.type === 'chips';
            const items = isArrayField ? parseArrayValue(value) : [];
            
            if (isArrayField && items.length === 0) return null;
            
            return (
              <div key={field.id} className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {field.label}
                </p>
                {isArrayField ? (
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-sm text-foreground"
                      >
                        <Check className="w-3 h-3 text-primary" />
                        {item}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-foreground">{value}</p>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header with success message */}
      <div className={cn("relative px-5 pt-12 pb-6", gradientClasses[config.gradient])}>
        <button
          onClick={() => navigate('/threads')}
          className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center mb-4"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Icon className="w-6 h-6 text-white" strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">
              {config.title}
            </h1>
            <p className="text-white/70 text-sm">
              {savedMemories.length} memories saved
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Check className="w-5 h-5 text-white" />
          </div>
        </div>

        <p className="text-white/80 text-sm">
          Your {isSingleEntry ? config.entryName : config.entryNamePlural} {isSingleEntry ? 'has' : 'have'} been added to memory. You can update {isSingleEntry ? 'it' : 'them'} anytime.
        </p>
      </div>
      
      <div className="px-5 pt-4 pb-8">
        {isSingleEntry && entries.length > 0 ? (
          // Single-entry summary view
          renderSingleEntrySummary(entries[0])
        ) : (
          // Multi-entry list view
          <div className="space-y-3">
            {entries.map((entry, index) => {
              const entryMemories = getMemoriesForEntry(entry.id);
              const isExpanded = expandedEntryId === entry.id;

              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden"
                >
                  {/* Entry Header */}
                  <button
                    onClick={() => toggleExpanded(entry.id)}
                    className="w-full p-4 flex items-center justify-between text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">
                        {getEntryTitle(entry)}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {getEntrySubtitle(entry)} • {entryMemories.length} memories
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditEntry(entry.id);
                        }}
                        className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                      >
                        <Pencil className="w-4 h-4 text-muted-foreground" />
                      </button>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Memories List */}
                  <AnimatePresence>
                    {isExpanded && entryMemories.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-0 space-y-2">
                          {entryMemories.map((memory) => (
                            <div
                              key={memory.id}
                              className="bg-muted/50 rounded-xl px-3 py-2"
                            >
                              <p className="text-sm text-foreground">
                                {memory.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}

            {/* Add Another Card - only for multi-entry flows */}
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
        )}
      </div>
    </div>
  );
}
