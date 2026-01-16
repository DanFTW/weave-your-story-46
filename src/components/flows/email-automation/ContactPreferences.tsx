import { ArrowRight, Inbox, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SelectedContact, MonitoringPreferences } from "@/types/emailAutomation";

interface ContactPreferencesProps {
  contacts: SelectedContact[];
  onUpdatePreferences: (email: string, preferences: MonitoringPreferences) => void;
  onActivate: () => void;
  isActivating: boolean;
}

export function ContactPreferences({
  contacts,
  onUpdatePreferences,
  onActivate,
  isActivating,
}: ContactPreferencesProps) {
  const hasValidConfig = contacts.some(c => c.preferences.incoming || c.preferences.outgoing);

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">
          Configure Monitoring
        </h2>
        <p className="text-sm text-muted-foreground">
          Choose which emails to save as memories for each contact.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4">
        {contacts.map((contact) => (
          <div 
            key={contact.email}
            className="bg-muted/50 rounded-2xl p-4"
          >
            {/* Contact Header */}
            <div className="flex items-center gap-3 mb-4">
              <Avatar className="w-10 h-10">
                <AvatarImage src={contact.avatarUrl} />
                <AvatarFallback>
                  {contact.name?.[0] || contact.email[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                {contact.name && (
                  <p className="text-sm font-medium text-foreground truncate">
                    {contact.name}
                  </p>
                )}
                <p className="text-sm text-muted-foreground truncate">
                  {contact.email}
                </p>
              </div>
            </div>

            {/* Toggle Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Inbox className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">Incoming emails</span>
                </div>
                <Switch
                  checked={contact.preferences.incoming}
                  onCheckedChange={(checked) => 
                    onUpdatePreferences(contact.email, {
                      ...contact.preferences,
                      incoming: checked,
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">Outgoing emails</span>
                </div>
                <Switch
                  checked={contact.preferences.outgoing}
                  onCheckedChange={(checked) => 
                    onUpdatePreferences(contact.email, {
                      ...contact.preferences,
                      outgoing: checked,
                    })
                  }
                />
              </div>
            </div>

            {/* Warning if nothing selected */}
            {!contact.preferences.incoming && !contact.preferences.outgoing && (
              <p className="text-xs text-orange-500 mt-3">
                No monitoring enabled for this contact
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Activate Button */}
      <div className="pt-4 pb-safe">
        <Button
          onClick={onActivate}
          disabled={!hasValidConfig || isActivating}
          className="w-full h-14 text-base font-semibold rounded-2xl gap-2"
        >
          {isActivating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Activating...
            </>
          ) : (
            <>
              Activate Monitoring
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
