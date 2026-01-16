import { Plus, Trash2, Inbox, Send, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MonitoredContact } from "@/types/emailAutomation";
import { useState } from "react";

interface ActiveMonitoringProps {
  contacts: MonitoredContact[];
  isLoading: boolean;
  onAddMore: () => void;
  onRemove: (contactId: string) => Promise<boolean>;
}

export function ActiveMonitoring({
  contacts,
  isLoading,
  onAddMore,
  onRemove,
}: ActiveMonitoringProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRemove = async (contactId: string) => {
    setRemovingId(contactId);
    await onRemove(contactId);
    setRemovingId(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Mail className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          No contacts monitored yet
        </h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-xs">
          Add contacts to automatically save their emails as memories.
        </p>
        <Button onClick={onAddMore} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Contacts
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">
          Monitoring Active
        </h2>
        <p className="text-sm text-muted-foreground">
          {contacts.length} contact{contacts.length !== 1 ? 's' : ''} being monitored
        </p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3">
        {contacts.map((contact) => (
          <div 
            key={contact.id}
            className="bg-muted/50 rounded-2xl p-4 flex items-center gap-3"
          >
            <Avatar className="w-10 h-10">
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
              
              {/* Badges showing what's being monitored */}
              <div className="flex gap-2 mt-2">
                {contact.monitorIncoming && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Inbox className="w-3 h-3" />
                    Incoming
                  </Badge>
                )}
                {contact.monitorOutgoing && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Send className="w-3 h-3" />
                    Outgoing
                  </Badge>
                )}
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRemove(contact.id)}
              disabled={removingId === contact.id}
              className="shrink-0 text-muted-foreground hover:text-destructive"
            >
              {removingId === contact.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </Button>
          </div>
        ))}
      </div>

      {/* Add More Button */}
      <div className="pt-4 pb-safe">
        <Button
          variant="outline"
          onClick={onAddMore}
          className="w-full h-14 text-base font-semibold rounded-2xl gap-2"
        >
          <Plus className="w-5 h-5" />
          Add More Contacts
        </Button>
      </div>
    </div>
  );
}
