import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface AccountSwitchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationName: string;
  logoutUrl?: string;
  onContinue: () => void;
}

export function AccountSwitchDialog({
  open,
  onOpenChange,
  integrationName,
  logoutUrl,
  onContinue,
}: AccountSwitchDialogProps) {
  const handleOpenLogout = () => {
    if (logoutUrl) {
      window.open(logoutUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleContinue = () => {
    onOpenChange(false);
    onContinue();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Switch {integrationName} Account</DialogTitle>
          <DialogDescription>
            To connect a different account, you'll need to log out of {integrationName} in your browser first.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
              1
            </div>
            <div className="space-y-1">
              <p className="font-medium leading-none">Log out of {integrationName}</p>
              <p className="text-sm text-muted-foreground">
                Open {integrationName} in a new tab and sign out of your current account
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
              2
            </div>
            <div className="space-y-1">
              <p className="font-medium leading-none">Return here and continue</p>
              <p className="text-sm text-muted-foreground">
                You'll be prompted to log in with a different account
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {logoutUrl && (
            <Button
              variant="outline"
              onClick={handleOpenLogout}
              className="w-full sm:w-auto"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open {integrationName}
            </Button>
          )}
          <Button onClick={handleContinue} className="w-full sm:w-auto">
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
