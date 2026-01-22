import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface AccountSwitchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationName: string;
  logoutUrl: string;
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
    window.open(logoutUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Switch {integrationName} Account</DialogTitle>
          <DialogDescription className="pt-2">
            To connect a different account, you'll need to log out of {integrationName} first.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                1
              </div>
              <p className="text-sm text-muted-foreground">
                Open {integrationName} in a new tab and log out of your current account
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                2
              </div>
              <p className="text-sm text-muted-foreground">
                Return here and click Continue to connect a different account
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={handleOpenLogout}
            className="gap-2"
          >
            Open {integrationName}
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button onClick={onContinue}>
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
