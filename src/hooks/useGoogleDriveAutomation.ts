import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  GoogleDriveAutomationPhase,
  GoogleDriveAutomationConfig,
  GoogleDriveDocStats,
  GoogleDriveSearchResult,
} from "@/types/googleDriveAutomation";

export function useGoogleDriveAutomation() {
  const { toast } = useToast();
  const [phase, setPhase] = useState<GoogleDriveAutomationPhase>('auth-check');
  const [config, setConfig] = useState<GoogleDriveAutomationConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GoogleDriveSearchResult[]>([]);
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});

  const stats: GoogleDriveDocStats = {
    documentsSaved: config?.documentsSaved ?? 0,
    isActive: config?.isActive ?? false,
    lastSyncAt: config?.lastSyncAt ?? null,
  };

  const getSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({ title: "Authentication required", variant: "destructive" });
      return null;
    }
    return session;
  }, [toast]);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPhase('auth-check'); return; }

      const { data, error } = await supabase
        .from('googledrive_automation_config' as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading googledrive config:', error);
        toast({ title: "Error loading config", description: error.message, variant: "destructive" });
        return;
      }

      if (data) {
        const d = data as any;
        setConfig({
          id: d.id, userId: d.user_id, isActive: d.is_active,
          triggerInstanceId: d.trigger_instance_id ?? null,
          documentsSaved: d.documents_saved ?? 0,
          lastSyncAt: d.last_sync_at ?? null,
        });
      } else {
        const { data: newConfig, error: insertError } = await supabase
          .from('googledrive_automation_config' as any)
          .insert({ user_id: user.id, is_active: false })
          .select()
          .single();

        if (insertError) { console.error('Error creating config:', insertError); return; }

        const n = newConfig as any;
        setConfig({
          id: n.id, userId: n.user_id, isActive: n.is_active,
          triggerInstanceId: n.trigger_instance_id ?? null,
          documentsSaved: n.documents_saved ?? 0,
          lastSyncAt: n.last_sync_at ?? null,
        });
      }
      setPhase('ready');
    } catch (err) {
      console.error('Error in loadConfig:', err);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const activateMonitoring = useCallback(async (): Promise<boolean> => {
    if (!config) return false;
    setIsActivating(true);
    try {
      const session = await getSession();
      if (!session) return false;

      const { data, error } = await supabase.functions.invoke('googledrive-automation-triggers', {
        body: { action: 'activate' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Activation failed", description: error.message, variant: "destructive" });
        return false;
      }

      setConfig(prev => prev ? {
        ...prev,
        isActive: true,
        triggerInstanceId: data.triggerInstanceId ?? prev.triggerInstanceId,
      } : null);
      setPhase('ready');
      toast({ title: "Monitoring activated", description: "New Google Docs will be saved automatically" });
      return true;
    } catch (err) {
      console.error('Error activating monitoring:', err);
      toast({ title: "Activation failed", description: "An unexpected error occurred", variant: "destructive" });
      return false;
    } finally {
      setIsActivating(false);
    }
  }, [config, toast, getSession]);

  const deactivateMonitoring = useCallback(async (): Promise<boolean> => {
    if (!config) return false;
    try {
      const session = await getSession();
      if (!session) return false;

      const { error } = await supabase.functions.invoke('googledrive-automation-triggers', {
        body: { action: 'deactivate' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Deactivation failed", description: error.message, variant: "destructive" });
        return false;
      }

      setConfig(prev => prev ? { ...prev, isActive: false } : null);
      toast({ title: "Monitoring paused", description: "Automatic tracking has been stopped" });
      return true;
    } catch (err) {
      console.error('Error deactivating:', err);
      return false;
    }
  }, [config, toast, getSession]);

  const searchDocs = useCallback(async (query: string): Promise<GoogleDriveSearchResult[]> => {
    setIsSearching(true);
    try {
      const session = await getSession();
      if (!session) return [];

      const { data, error } = await supabase.functions.invoke('googledrive-automation-triggers', {
        body: { action: 'search-docs', query },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Search failed", description: error.message, variant: "destructive" });
        return [];
      }

      const results: GoogleDriveSearchResult[] = data.results ?? [];
      setSearchResults(results);
      return results;
    } catch (err) {
      console.error('Error searching docs:', err);
      toast({ title: "Search failed", variant: "destructive" });
      return [];
    } finally {
      setIsSearching(false);
    }
  }, [toast, getSession]);

  const saveDocument = useCallback(async (fileId: string, fileName: string): Promise<boolean> => {
    setIsSaving(prev => ({ ...prev, [fileId]: true }));
    try {
      const session = await getSession();
      if (!session) return false;

      const { data, error } = await supabase.functions.invoke('googledrive-automation-triggers', {
        body: { action: 'save-doc', fileId, fileName },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Save failed", description: error.message, variant: "destructive" });
        return false;
      }

      if (data.alreadySaved) {
        toast({ title: "Already saved", description: `${fileName} was already saved as a memory` });
      } else {
        toast({ title: "Document saved", description: `${fileName} saved as a memory` });
        setConfig(prev => prev ? { ...prev, documentsSaved: prev.documentsSaved + 1 } : null);
      }

      // Mark as saved in search results
      setSearchResults(prev => prev.map(r => r.id === fileId ? { ...r, alreadySaved: true } : r));
      return true;
    } catch (err) {
      console.error('Error saving doc:', err);
      toast({ title: "Save failed", variant: "destructive" });
      return false;
    } finally {
      setIsSaving(prev => ({ ...prev, [fileId]: false }));
    }
  }, [toast, getSession]);

  const reset = useCallback(() => {
    setPhase('auth-check');
    setConfig(null);
  }, []);

  return {
    phase, setPhase, config, stats, isLoading, isActivating, isPolling,
    isSearching, searchResults, isSaving,
    loadConfig, activateMonitoring, deactivateMonitoring,
    searchDocs, saveDocument, reset,
  };
}
