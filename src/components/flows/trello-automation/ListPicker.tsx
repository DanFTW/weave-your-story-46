import { Loader2, RefreshCw, LayoutList, CreditCard } from "lucide-react";
import { TrelloListWithCards } from "@/types/trelloAutomation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface BoardOverviewProps {
  lists: TrelloListWithCards[];
  isLoading: boolean;
  isSyncing: boolean;
  boardName: string;
  onSync: () => void;
}

export function BoardOverview({
  lists,
  isLoading,
  isSyncing,
  boardName,
  onSync,
}: BoardOverviewProps) {
  if (isLoading && lists.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  const totalCards = lists.reduce((sum, l) => sum + l.cards.length, 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Board summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <LayoutList className="w-4 h-4" />
          <span>{lists.length} lists · {totalCards} cards</span>
        </div>
      </div>

      {/* Lists accordion */}
      {lists.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          No lists found on this board.
        </div>
      ) : (
        <Accordion type="multiple" className="flex flex-col gap-2">
          {lists.map((list) => (
            <AccordionItem
              key={list.id}
              value={list.id}
              className="border border-border/50 rounded-2xl overflow-hidden bg-card px-4"
            >
              <AccordionTrigger className="py-4 hover:no-underline">
                <div className="flex items-center gap-3 w-full pr-2">
                  <span className="font-semibold text-foreground text-sm truncate flex-1 text-left">
                    {list.name}
                  </span>
                  <Badge
                    variant="secondary"
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums"
                  >
                    {list.cards.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                {list.cards.length === 0 ? (
                  <p className="text-muted-foreground text-xs pl-1">No cards</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {list.cards.map((card) => (
                      <li
                        key={card.id}
                        className="flex items-start gap-2 rounded-xl bg-muted/50 px-3 py-2.5"
                      >
                        <CreditCard className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground truncate">{card.name}</p>
                          {card.due && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Due {new Date(card.due).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        {card.labels && card.labels.length > 0 && (
                          <div className="flex gap-1 flex-shrink-0">
                            {card.labels.slice(0, 2).map((label, i) => (
                              <span
                                key={i}
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: label.color || 'hsl(var(--muted-foreground))' }}
                              />
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Sync button */}
      <button
        onClick={onSync}
        disabled={isSyncing}
        className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-base flex items-center justify-center gap-2 disabled:opacity-60 transition-opacity"
      >
        {isSyncing ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <RefreshCw className="w-5 h-5" />
        )}
        {isSyncing ? "Syncing…" : "Sync Now"}
      </button>
    </div>
  );
}
