import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Contact } from "@/types/emailDump";
import { 
  EmailAutomationPhase, 
  SelectedContact, 
  MonitoredContact,
  MonitoringPreferences 
} from "@/types/emailAutomation";

export interface TriggerStatus {
  triggerId: string;
  status: string;
  enabled: boolean;
  lastPolled?: string;
  config?: Record<string, unknown>;
  error?: string;
}

export interface TriggerLog {
  id: string;
  timestamp: string;
  triggerId: string;
  status: string;
  payload?: unknown;
}

interface UseEmailAutomationReturn {
  phase: EmailAutomationPhase;
  setPhase: (phase: EmailAutomationPhase) => void;
  selectedContacts: SelectedContact[];
  monitoredContacts: MonitoredContact[];
  searchResults: Contact[];
  isSearching: boolean;
  isActivating: boolean;
  isLoading: boolean;
  isCheckingStatus: boolean;
  triggerStatuses: Record<string, TriggerStatus>;
  searchContacts: (query: string) => Promise<void>;
  selectContact: (email: string, name?: string, avatarUrl?: string) => void;
  deselectContact: (email: string) => void;
  updatePreferences: (email: string, preferences: MonitoringPreferences) => void;
  clearSelection: () => void;
  activateMonitoring: () => Promise<boolean>;
  deactivateContact: (contactId: string) => Promise<boolean>;
  loadMonitoredContacts: () => Promise<void>;
  checkTriggerStatus: (triggerIds: string[]) => Promise<TriggerStatus[]>;
  enableTrigger: (triggerId: string) => Promise<boolean>;
  fetchTriggerLogs: () => Promise<TriggerLog[]>;
  reset: () => void;
}

export function useEmailAutomation(): UseEmailAutomationReturn {
  const { toast } = useToast();
  
  const [phase, setPhase] = useState<EmailAutomationPhase>('auth-check');
  const [selectedContacts, setSelectedContacts] = useState<SelectedContact[]>([]);
  const [monitoredContacts, setMonitoredContacts] = useState<MonitoredContact[]>([]);
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [triggerStatuses, setTriggerStatuses] = useState<Record<string, TriggerStatus>>({});

  // Load existing monitored contacts from database
  const loadMonitoredContacts = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('email_automation_contacts')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const contacts: MonitoredContact[] = (data || []).map((row: any) => ({
        id: row.id,
        email: row.email_address,
        name: row.contact_name,
        monitorIncoming: row.monitor_incoming,
        monitorOutgoing: row.monitor_outgoing,
        incomingTriggerId: row.incoming_trigger_id,
        outgoingTriggerId: row.outgoing_trigger_id,
        isActive: row.is_active,
        createdAt: row.created_at,
      }));

      setMonitoredContacts(contacts);
      
      // If we have existing contacts, go to active phase
      if (contacts.length > 0 && phase === 'auth-check') {
        setPhase('active');
      }
    } catch (error) {
      console.error('Failed to load monitored contacts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [phase]);

  // Check trigger status from Composio
  const checkTriggerStatus = useCallback(async (triggerIds: string[]): Promise<TriggerStatus[]> => {
    const validIds = triggerIds.filter(Boolean);
    if (validIds.length === 0) return [];

    setIsCheckingStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke('email-automation-triggers', {
        body: { action: 'status', triggerIds: validIds },
      });

      if (error) throw error;

      const statuses = data?.statuses || [];
      
      // Update local state
      const statusMap: Record<string, TriggerStatus> = {};
      for (const status of statuses) {
        statusMap[status.triggerId] = status;
      }
      setTriggerStatuses(prev => ({ ...prev, ...statusMap }));

      return statuses;
    } catch (error) {
      console.error('Failed to check trigger status:', error);
      toast({
        title: "Status check failed",
        description: "Could not fetch trigger status from Composio.",
        variant: "destructive",
      });
      return [];
    } finally {
      setIsCheckingStatus(false);
    }
  }, [toast]);

  // Enable a trigger
  const enableTrigger = useCallback(async (triggerId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('email-automation-triggers', {
        body: { action: 'enable', triggerId },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Trigger enabled",
          description: "The trigger has been re-enabled.",
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to enable trigger:', error);
      toast({
        title: "Enable failed",
        description: "Could not enable trigger.",
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  // Fetch trigger logs from Composio
  const fetchTriggerLogs = useCallback(async (): Promise<TriggerLog[]> => {
    try {
      const { data, error } = await supabase.functions.invoke('email-automation-triggers', {
        body: { action: 'logs' },
      });

      if (error) throw error;

      return data?.logs || [];
    } catch (error) {
      console.error('Failed to fetch trigger logs:', error);
      return [];
    }
  }, []);

  // Search contacts using Gmail API
  const searchContacts = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke('gmail-search', {
        body: { query },
      });

      if (error) throw error;
      setSearchResults(data?.contacts || []);
    } catch (error) {
      console.error('Search failed:', error);
      toast({
        title: "Search failed",
        description: "Could not search contacts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  }, [toast]);

  // Select a contact with default preferences (both incoming and outgoing)
  const selectContact = useCallback((email: string, name?: string, avatarUrl?: string) => {
    setSelectedContacts(prev => {
      if (prev.some(c => c.email === email)) return prev;
      return [...prev, {
        email,
        name,
        avatarUrl,
        preferences: { incoming: true, outgoing: true },
      }];
    });
  }, []);

  // Deselect a contact
  const deselectContact = useCallback((email: string) => {
    setSelectedContacts(prev => prev.filter(c => c.email !== email));
  }, []);

  // Update monitoring preferences for a contact
  const updatePreferences = useCallback((email: string, preferences: MonitoringPreferences) => {
    setSelectedContacts(prev => 
      prev.map(c => c.email === email ? { ...c, preferences } : c)
    );
  }, []);

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedContacts([]);
    setSearchResults([]);
  }, []);

  // Activate monitoring by creating Composio triggers
  const activateMonitoring = useCallback(async () => {
    if (selectedContacts.length === 0) return false;

    // Filter out contacts with no monitoring enabled
    const validContacts = selectedContacts.filter(
      c => c.preferences.incoming || c.preferences.outgoing
    );

    if (validContacts.length === 0) {
      toast({
        title: "No monitoring configured",
        description: "Please enable incoming or outgoing monitoring for at least one contact.",
        variant: "destructive",
      });
      return false;
    }

    setIsActivating(true);
    setPhase('activating');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Call edge function to create triggers
      const { data, error } = await supabase.functions.invoke('email-automation-triggers', {
        body: {
          action: 'create',
          contacts: validContacts.map(c => ({
            email: c.email,
            name: c.name,
            monitorIncoming: c.preferences.incoming,
            monitorOutgoing: c.preferences.outgoing,
          })),
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Monitoring activated",
          description: `Now monitoring ${validContacts.length} contact${validContacts.length > 1 ? 's' : ''}.`,
        });
        
        // Reload monitored contacts
        await loadMonitoredContacts();
        setSelectedContacts([]);
        setPhase('active');
        return true;
      } else {
        throw new Error(data?.error || 'Failed to create triggers');
      }
    } catch (error) {
      console.error('Activation failed:', error);
      toast({
        title: "Activation failed",
        description: error instanceof Error ? error.message : "Failed to activate monitoring.",
        variant: "destructive",
      });
      setPhase('preferences');
      return false;
    } finally {
      setIsActivating(false);
    }
  }, [selectedContacts, toast, loadMonitoredContacts]);

  // Deactivate monitoring for a contact
  const deactivateContact = useCallback(async (contactId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const contact = monitoredContacts.find(c => c.id === contactId);
      if (!contact) return false;

      // Call edge function to delete triggers
      const { data, error } = await supabase.functions.invoke('email-automation-triggers', {
        body: {
          action: 'delete',
          contactId,
          incomingTriggerId: contact.incomingTriggerId,
          outgoingTriggerId: contact.outgoingTriggerId,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Contact removed",
          description: `Stopped monitoring ${contact.email}.`,
        });
        
        // Remove from local state
        setMonitoredContacts(prev => prev.filter(c => c.id !== contactId));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Deactivation failed:', error);
      toast({
        title: "Failed to remove contact",
        description: "Could not stop monitoring. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  }, [monitoredContacts, toast]);

  // Reset state
  const reset = useCallback(() => {
    setPhase('contact-search');
    setSelectedContacts([]);
    setSearchResults([]);
  }, []);

  return {
    phase,
    setPhase,
    selectedContacts,
    monitoredContacts,
    searchResults,
    isSearching,
    isActivating,
    isLoading,
    isCheckingStatus,
    triggerStatuses,
    searchContacts,
    selectContact,
    deselectContact,
    updatePreferences,
    clearSelection,
    activateMonitoring,
    deactivateContact,
    loadMonitoredContacts,
    checkTriggerStatus,
    enableTrigger,
    fetchTriggerLogs,
    reset,
  };
}