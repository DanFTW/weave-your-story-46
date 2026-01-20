import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Copy, Check, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface OAuthConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationName: string;
  integrationIcon: string;
  onConfirm: () => void;
  returnUrl: string;
}

export function OAuthConfirmDialog({
  open,
  onOpenChange,
  integrationName,
  integrationIcon,
  onConfirm,
  returnUrl,
}: OAuthConfirmDialogProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(returnUrl);
      setCopied(true);
      toast({
        title: "Link copied",
        description: "You can paste this in your browser to return to Weave",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please manually copy the link",
        variant: "destructive",
      });
    }
  };

  const handleConfirm = () => {
    onOpenChange(false);
    onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl overflow-hidden bg-muted flex items-center justify-center">
            <img 
              src={integrationIcon} 
              alt={integrationName} 
              className="w-10 h-10 object-contain"
            />
          </div>
          <DialogTitle className="text-xl">Connect to {integrationName}</DialogTitle>
          <DialogDescription className="text-base pt-2">
            You'll be redirected to {integrationName} to authorize access to your account.
            <span className="block mt-2 text-sm text-muted-foreground">
              Note: You may need to log in via the {integrationName} website, even if you're logged into the mobile app.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 my-2">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-destructive">
                If you cancel on {integrationName}
              </p>
              <p className="text-sm text-muted-foreground">
                You won't be automatically redirected back. Use the link below to return to Weave:
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="w-full justify-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy return link
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button 
            onClick={handleConfirm} 
            className="w-full gap-2"
          >
            Continue to {integrationName}
            <ExternalLink className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
