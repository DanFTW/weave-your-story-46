import { Plus, Pencil, Trash2, Sparkles, Check } from "lucide-react";
import { FlowConfig, FlowEntry } from "@/types/flows";
import { ThreadSplash } from "@/components/thread/ThreadSplash";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface FlowEntryListProps {
  config: FlowConfig;
  entries: FlowEntry[];
  onAddEntry: () => void;
  onEditEntry: (entryId: string) => void;
  onDeleteEntry: (entryId: string) => void;
  onGenerate: () => void;
}

export function FlowEntryList({
  config,
  entries,
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
  onGenerate,
}: FlowEntryListProps) {
  const isSingleEntry = config.singleEntry;
  
  const getEntryTitle = (entry: FlowEntry) => {
    // Use first text field as title (usually 'name' or 'title')
    const titleField = config.fields.find(f => f.type === 'text');
    return titleField ? entry.data[titleField.id] || 'Untitled' : 'Untitled';
  };

  const getEntrySubtitle = (entry: FlowEntry) => {
    // Use first select or second text field as subtitle
    const subtitleField = config.fields.find(f => f.type === 'select') || 
                          config.fields.filter(f => f.type === 'text')[1];
    return subtitleField ? entry.data[subtitleField.id] : '';
  };

  // For single-entry flows, parse and display array values
  const parseArrayValue = (value: string): string[] => {
    if (!value) return [];
    return value.split('|||').filter(v => v.trim());
  };

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
          <h3 className="font-semibold text-foreground">Your {config.entryName}</h3>
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
    <div className="min-h-screen bg-background flex flex-col">
      <ThreadSplash
        title={config.title}
        icon={config.icon}
        gradient={config.gradient}
      />
      
      <div className="flex-1 px-5 pt-4 pb-32">
        {isSingleEntry && entries.length > 0 ? (
          // Single-entry summary view
          renderSingleEntrySummary(entries[0])
        ) : (
          // Multi-entry list view
          <div className="space-y-3">
            {entries.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-card rounded-2xl p-4 shadow-sm border border-border"
              >
                <div className="flex items-center justify-between">
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
                      onClick={() => onDeleteEntry(entry.id)}
                      className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
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
        )}
      </div>

      {/* Generate Button */}
      <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-background via-background to-transparent pt-10">
        <Button
          onClick={onGenerate}
          disabled={entries.length === 0}
          className="w-full h-12 text-base font-medium gap-2"
        >
          <Sparkles className="w-5 h-5" />
          Generate Memories
        </Button>
      </div>
    </div>
  );
}
