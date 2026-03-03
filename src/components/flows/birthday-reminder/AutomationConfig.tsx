import { Gift, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BirthdayReminderConfig } from "@/types/birthdayReminder";

interface AutomationConfigProps {
  config: BirthdayReminderConfig;
  onActivate: () => void;
  isActivating: boolean;
}

export function AutomationConfig({ config, onActivate, isActivating }: AutomationConfigProps) {
  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Gift className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">Birthday Reminders</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Automatically scans your memories for birthdays. When one is exactly {config.daysBefore} days away, 
              we'll compose a personalized draft using everything you know about that person and save it in your Gmail drafts for you to review and send.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-4">
        <h4 className="font-medium text-foreground mb-3">How it works</h4>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
            <span>Searches your memories for birthday entries (e.g. "John's birthday is March 15")</span>
          </div>
          <div className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
            <span>Gathers context memories about that person (interests, hobbies, etc.)</span>
          </div>
          <div className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
            <span>Finds their email in your memories (e.g. "John's email is john@example.com")</span>
          </div>
          <div className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
            <span>Creates a personalized birthday draft in your Gmail for you to review and send</span>
          </div>
        </div>
      </div>

      <Button
        onClick={onActivate}
        disabled={isActivating}
        className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground"
      >
        {isActivating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Activating...
          </>
        ) : (
          "Activate Reminders"
        )}
      </Button>
    </div>
  );
}
