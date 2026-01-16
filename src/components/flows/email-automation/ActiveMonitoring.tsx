import { Plus, Trash2, Inbox, Send, Loader2, Mail, RefreshCw, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MonitoredContact } from "@/types/emailAutomation";
import { TriggerStatus } from "@/hooks/useEmailAutomation";
import { useState } from "react";

interface ActiveMonitoringProps {
  contacts: MonitoredContact[];
  isLoading: boolean;
  isCheckingStatus: boolean;
  triggerStatuses: Record<string, TriggerStatus>;
  onAddMore: () => void;
  onRemove: (contactId: string) => Promise<boolean>;
  onCheckStatus: (triggerIds: string[]) => Promise<TriggerStatus[]>;
  onEnableTrigger: (triggerId: string) => Promise<boolean>;
}

function TriggerStatusIcon({ status }: { status?: TriggerStatus }) {
  if (!status) return null;
  
  if (status.error || status.status === 'error') {
    return <XCircle className="w-3 h-3 text-destructive" />;
  }
  if (!status.enabled) {
    return <AlertCircle className="w-3 h-3 text-yellow-500" />;
  }
  return <CheckCircle className="w-3 h-3 text-green-500" />;
}

export function ActiveMonitoring({
  contacts,
  isLoading,
  isCheckingStatus,
  triggerStatuses,
  onAddMore,
  onRemove,
  onCheckStatus,
  onEnableTrigger,
}: ActiveMonitoringProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [enablingTriggerId, setEnablingTriggerId] = useState<string | null>(null);

  const handleRemove = async (contactId: string) => {
    setRemovingId(contactId);
    await onRemove(contactId);
    setRemovingId(null);
  };

  const handleCheckAllStatus = async () => {
    const allTriggerIds: string[] = [];
    for (const contact of contacts) {
      if (contact.incomingTriggerId) allTriggerIds.push(contact.incomingTriggerId);
      if (contact.outgoingTriggerId) allTriggerIds.push(contact.outgoingTriggerId);
    }
    await onCheckStatus(allTriggerIds);
  };

  const handleEnableTrigger = async (triggerId: string) => {
    setEnablingTriggerId(triggerId);
    await onEnableTrigger(triggerId);
    // Refresh status after enabling
    await onCheckStatus([triggerId]);
    setEnablingTriggerId(null);
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
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">
            Monitoring Active
          </h2>
          <p className="text-sm text-muted-foreground">
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''} being monitored
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleCheckAllStatus}
          disabled={isCheckingStatus}
          className="gap-2"
        >
          {isCheckingStatus ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Check Status
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3">
        {contacts.map((contact) => {
          const incomingStatus = contact.incomingTriggerId ? triggerStatuses[contact.incomingTriggerId] : undefined;
          const outgoingStatus = contact.outgoingTriggerId ? triggerStatuses[contact.outgoingTriggerId] : undefined;
          
          return (
            <div 
              key={contact.id}
              className="bg-muted/50 rounded-2xl p-4"
            >
              <div className="flex items-center gap-3">
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
              
              {/* Badges showing what's being monitored with status */}
              <div className="flex gap-2 mt-3 flex-wrap">
                {contact.monitorIncoming && (
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Inbox className="w-3 h-3" />
                      Incoming
                      <TriggerStatusIcon status={incomingStatus} />
                    </Badge>
                    {incomingStatus && !incomingStatus.enabled && contact.incomingTriggerId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => handleEnableTrigger(contact.incomingTriggerId!)}
                        disabled={enablingTriggerId === contact.incomingTriggerId}
                      >
                        {enablingTriggerId === contact.incomingTriggerId ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          "Enable"
                        )}
                      </Button>
                    )}
                  </div>
                )}
                {contact.monitorOutgoing && (
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Send className="w-3 h-3" />
                      Outgoing
                      <TriggerStatusIcon status={outgoingStatus} />
                    </Badge>
                    {outgoingStatus && !outgoingStatus.enabled && contact.outgoingTriggerId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => handleEnableTrigger(contact.outgoingTriggerId!)}
                        disabled={enablingTriggerId === contact.outgoingTriggerId}
                      >
                        {enablingTriggerId === contact.outgoingTriggerId ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          "Enable"
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Show trigger details if status was fetched */}
              {(incomingStatus || outgoingStatus) && (
                <div className="mt-2 text-xs text-muted-foreground space-y-1">
                  {incomingStatus?.lastPolled && (
                    <p>Incoming last polled: {new Date(incomingStatus.lastPolled).toLocaleString()}</p>
                  )}
                  {outgoingStatus?.lastPolled && (
                    <p>Outgoing last polled: {new Date(outgoingStatus.lastPolled).toLocaleString()}</p>
                  )}
                  {incomingStatus?.error && (
                    <p className="text-destructive">Incoming error: {incomingStatus.error}</p>
                  )}
                  {outgoingStatus?.error && (
                    <p className="text-destructive">Outgoing error: {outgoingStatus.error}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
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