import { useEffect, useState } from "react";
import { Share2, Trash2, Globe2, Lock, Users, Tag, Sparkles, Loader2 } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMyShares, MyShare } from "@/hooks/useMyShares";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface ManageSharedMemoriesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ShareCard({ share, onRevoke }: { share: MyShare; onRevoke: (id: string) => void }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const snippet = share.memory_content?.content?.slice(0, 120) || "Memory content unavailable";
  const isGated = share.visibility === "recipients_only";
  const scopeIcon =
    share.share_scope === "single" ? <Share2 className="h-3.5 w-3.5" /> :
    share.share_scope === "thread" ? <Tag className="h-3.5 w-3.5" /> :
    <Sparkles className="h-3.5 w-3.5" />;

  return (
    <>
      <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border/30">
          <div className="flex items-center gap-2">
            {scopeIcon}
            <span className="text-xs font-medium text-muted-foreground capitalize">{share.share_scope}</span>
          </div>
          <div className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
            isGated ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          )}>
            {isGated ? <Lock className="h-2.5 w-2.5" /> : <Globe2 className="h-2.5 w-2.5" />}
            {isGated ? "Gated" : "Open"}
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-3 space-y-2">
          <p className="text-sm text-foreground line-clamp-2">{snippet}{snippet.length >= 120 ? "…" : ""}</p>

          {/* Recipients */}
          {share.recipients.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {share.recipients.length} recipient{share.recipients.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            Shared {format(parseISO(share.created_at), "MMM d, yyyy")}
          </p>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-border/30 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 text-xs gap-1.5"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Revoke
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this share?</AlertDialogTitle>
            <AlertDialogDescription>
              Recipients will permanently lose access to this shared memory. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onRevoke(share.id)}
            >
              Revoke access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function ManageSharedMemories({ open, onOpenChange }: ManageSharedMemoriesProps) {
  const { shares, isLoading, fetchShares, revokeShare } = useMyShares();

  useEffect(() => {
    if (open) fetchShares();
  }, [open, fetchShares]);

  const handleRevoke = async (id: string) => {
    const ok = await revokeShare(id);
    if (ok) {
      toast.success("Share revoked");
    } else {
      toast.error("Failed to revoke share");
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Manage Shared Memories
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-6 overflow-y-auto space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Loading your shares…</p>
            </div>
          ) : shares.length === 0 ? (
            <div className="text-center py-12">
              <Share2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">You haven't shared any memories yet.</p>
            </div>
          ) : (
            shares.map((s) => <ShareCard key={s.id} share={s} onRevoke={handleRevoke} />)
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
