import { RefreshCw, Layout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TrelloBoard } from "@/types/trelloAutomation";

interface BoardPickerProps {
  boards: TrelloBoard[];
  isLoading: boolean;
  onSelectBoard: (board: TrelloBoard) => void;
  onRefresh: () => void;
}

export function BoardPicker({ boards, isLoading, onSelectBoard, onRefresh }: BoardPickerProps) {
  if (isLoading && boards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin mb-4" />
        <p className="text-muted-foreground">Loading your boards...</p>
      </div>
    );
  }

  if (boards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Layout className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4">No boards found</p>
        <Button variant="outline" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Choose which board to monitor for new and completed tasks.
        </p>
        <Button variant="ghost" size="icon" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="grid gap-3">
        {boards.map((board) => (
          <button
            key={board.id}
            onClick={() => onSelectBoard(board)}
            className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/50 hover:bg-accent/50 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-lg bg-[#0052CC] flex items-center justify-center flex-shrink-0">
              <Layout className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground truncate">{board.name}</p>
              {board.url && (
                <p className="text-sm text-muted-foreground truncate">{board.url}</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
