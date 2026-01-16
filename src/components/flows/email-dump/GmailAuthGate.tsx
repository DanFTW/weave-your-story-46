import { Mail, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface GmailAuthGateProps {
  isConnected: boolean;
  isConnecting: boolean;
  connectedAccount: {
    name: string;
    email: string;
    avatarUrl?: string;
  } | null;
  onConnect: () => void;
  onContinue: () => void;
}

export function GmailAuthGate({
  isConnected,
  isConnecting,
  connectedAccount,
  onConnect,
  onContinue,
}: GmailAuthGateProps) {
  if (isConnected && connectedAccount) {
    return (
      <div className="flex flex-col items-center text-center py-8">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-primary" />
        </div>
        
        <h2 className="text-lg font-semibold text-foreground mb-2">
          Gmail Connected
        </h2>
        
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/50 mb-6">
          <Avatar className="w-10 h-10">
            <AvatarImage src={connectedAccount.avatarUrl} />
            <AvatarFallback>
              {connectedAccount.email[0]?.toUpperCase() || 'G'}
            </AvatarFallback>
          </Avatar>
          <div className="text-left">
            {connectedAccount.name && (
              <p className="text-sm font-medium text-foreground">
                {connectedAccount.name}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {connectedAccount.email}
            </p>
          </div>
        </div>

        <Button
          onClick={onContinue}
          className="w-full h-14 text-base font-semibold rounded-2xl gap-2"
        >
          Continue to Search
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center py-8">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Mail className="w-8 h-8 text-muted-foreground" />
      </div>
      
      <h2 className="text-lg font-semibold text-foreground mb-2">
        Connect Gmail
      </h2>
      
      <p className="text-muted-foreground mb-8 max-w-xs">
        Connect your Gmail account to search contacts and extract emails as memories.
      </p>

      <Button
        onClick={onConnect}
        disabled={isConnecting}
        className="w-full h-14 text-base font-semibold rounded-2xl gap-2"
      >
        {isConnecting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg" 
              alt="Gmail" 
              className="w-5 h-5" 
            />
            Connect Gmail
          </>
        )}
      </Button>
    </div>
  );
}
