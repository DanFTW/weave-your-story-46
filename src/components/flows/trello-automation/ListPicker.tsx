import { CheckCircle2, List } from "lucide-react";
import { TrelloList } from "@/types/trelloAutomation";

interface ListPickerProps {
  lists: TrelloList[];
  isLoading: boolean;
  boardName: string;
  onSelectList: (list: TrelloList) => void;
}

export function ListPicker({ lists, isLoading, boardName, onSelectList }: ListPickerProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-muted-foreground">Loading lists...</p>
      </div>
    );
  }

  if (lists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <List className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No lists found on this board</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">
          Select which list represents completed tasks on <span className="font-medium text-foreground">{boardName}</span>.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          When cards are moved to this list, they'll be saved as completed task memories.
        </p>
      </div>

      <div className="grid gap-3">
        {lists.map((list) => (
          <button
            key={list.id}
            onClick={() => onSelectList(list)}
            className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/50 hover:bg-accent/50 transition-all text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">{list.name}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
