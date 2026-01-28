import { useNavigate } from "react-router-dom";
import { ChevronLeft, Twitter, User, Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { TrackedTwitterAccount } from "@/types/twitterAlphaTracker";

interface AutomationConfigProps {
  account: TrackedTwitterAccount;
  onActivate: () => void;
  onChangeAccount: () => void;
  isActivating: boolean;
}

export function AutomationConfig({
  account,
  onActivate,
  onChangeAccount,
  isActivating,
}: AutomationConfigProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-nav">
      {/* Header */}
      <div className="relative px-5 pt-status-bar pb-6 thread-gradient-blue">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/threads")}
            className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>

          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">
              Twitter Alpha Tracker
            </h1>
            <p className="text-white/70 text-sm truncate">Configure tracking</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pt-6 space-y-6">
        {/* Selected Account Card */}
        <div className="p-4 rounded-xl border border-border bg-card">
          <p className="text-sm text-muted-foreground mb-3">Tracking</p>
          <div className="flex items-center gap-3">
            <Avatar className="w-14 h-14">
              {account.avatarUrl ? (
                <AvatarImage src={account.avatarUrl} alt={account.displayName} />
              ) : null}
              <AvatarFallback>
                <User className="w-6 h-6 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-lg truncate">
                {account.displayName || account.username}
              </p>
              <p className="text-muted-foreground truncate">
                @{account.username}
              </p>
            </div>

            <Twitter className="w-6 h-6 text-[#1DA1F2] flex-shrink-0" />
          </div>
        </div>

        {/* Info */}
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">How it works</p>
              <p className="text-sm text-muted-foreground mt-1">
                We'll check for new posts from @{account.username} periodically
                and save them as memories automatically.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-4">
          <Button
            onClick={onActivate}
            disabled={isActivating}
            className="w-full h-12 text-base thread-gradient-blue border-0 hover:opacity-90"
          >
            <Zap className="w-5 h-5 mr-2" />
            Start Tracking
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>

          <Button
            variant="outline"
            onClick={onChangeAccount}
            className="w-full"
          >
            Change Account
          </Button>
        </div>
      </div>
    </div>
  );
}
