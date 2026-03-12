import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLiamMemory } from "@/hooks/useLiamMemory";
import { useToast } from "@/hooks/use-toast";
import { GeneratedMemory } from "@/types/flows";
import {
  GoogleDriveAutomationPhase,
  GoogleDriveAutomationConfig,
  GoogleDriveDocStats,
  GoogleDriveSearchResult,
  DocSource,
} from "@/types/googleDriveAutomation";

export function useGoogleDriveAutomation() {
  const { toast } = useToast();
  const { createMemory } = useLiamMemory();
  const [phase, setPhase] = useState<GoogleDriveAutomationPhase>('auth-check');
  const [config, setConfig] = useState<GoogleDriveAutomationConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GoogleDriveSearchResult[]>([]);
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});
  const [activeSource, setActiveSource] = useState<DocSource>('googledrive');

  // Generate → preview → confirm state
  const [generatedMemories, setGeneratedMemories] = useState<GeneratedMemory[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<{ fileId: string; fileName: string } | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

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

      const fnName = activeSource === 'dropbox' ? 'dropbox-doc-actions' : 'googledrive-automation-triggers';

      const { data, error } = await supabase.functions.invoke(fnName, {
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
  }, [toast, getSession, activeSource]);

  // === NEW: Generate memories from document content ===

  const generateFromDoc = useCallback(async (fileId: string, fileName: string) => {
    setSelectedDoc({ fileId, fileName });
    setPhase('generating');

    try {
      const session = await getSession();
      if (!session) { setPhase('ready'); return; }

      const fnName = activeSource === 'dropbox' ? 'dropbox-doc-actions' : 'googledrive-automation-triggers';

      // Step 1: Export document content
      const { data: exportData, error: exportError } = await supabase.functions.invoke(
        fnName,
        {
          body: { action: 'export-doc', fileId, fileName },
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      if (exportError) throw new Error(exportError.message || 'Failed to export document');
      if (!exportData?.success || !exportData?.content) {
        throw new Error(exportData?.error || 'No content found in document');
      }

      // Step 2: Truncate and send to generate-memories
      const content = exportData.content;
      const truncated = content.length > 12000
        ? content.substring(0, 12000) + '\n\n[Content truncated...]'
        : content;

      const { data: genData, error: genError } = await supabase.functions.invoke('generate-memories', {
        body: {
          flowType: 'googledrive-doc',
          entryName: 'document content',
          entryNamePlural: 'document contents',
          entries: [{
            id: fileId,
            data: { content: truncated, title: fileName },
            createdAt: new Date().toISOString(),
          }],
          memoryTag: 'GOOGLEDRIVE',
        },
      });

      if (genError) throw new Error(genError.message || 'Failed to generate memories');
      if (!genData?.memories || genData.memories.length === 0) {
        throw new Error('Could not extract any memories from this document');
      }

      setGeneratedMemories(genData.memories as GeneratedMemory[]);
      setPhase('preview');
    } catch (error) {
      console.error('Generate from doc error:', error);
      toast({
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Failed to generate memories',
        variant: 'destructive',
      });
      setPhase('ready');
    }
  }, [toast, getSession]);

  const updateMemory = useCallback((id: string, content: string) => {
    setGeneratedMemories(prev => prev.map(m => m.id === id ? { ...m, content } : m));
  }, []);

  const deleteMemory = useCallback((id: string) => {
    setGeneratedMemories(prev => prev.map(m => m.id === id ? { ...m, isDeleted: true } : m));
  }, []);

  const toggleEdit = useCallback((id: string) => {
    setGeneratedMemories(prev => prev.map(m => m.id === id ? { ...m, isEditing: !m.isEditing } : m));
  }, []);

  const updateTag = useCallback((id: string, tag: string) => {
    setGeneratedMemories(prev => prev.map(m => m.id === id ? { ...m, tag } : m));
  }, []);

  const confirmMemories = useCallback(async () => {
    setIsConfirming(true);
    const activeMemories = generatedMemories.filter(m => !m.isDeleted);

    try {
      let saved = 0;
      for (const memory of activeMemories) {
        const success = await createMemory(memory.content, memory.tag, { silent: true });
        if (success) saved++;
      }

      if (saved === 0) throw new Error('Failed to save any memories');

      // Mark the doc as processed
      if (selectedDoc) {
        const session = await getSession();
        if (session) {
          await supabase.functions.invoke('googledrive-automation-triggers', {
            body: { action: 'save-doc', fileId: selectedDoc.fileId, fileName: selectedDoc.fileName },
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
        }
        // Update config count
        setConfig(prev => prev ? { ...prev, documentsSaved: prev.documentsSaved + 1 } : null);
        setSearchResults(prev => prev.map(r => r.id === selectedDoc.fileId ? { ...r, alreadySaved: true } : r));
      }

      setSavedCount(saved);
      toast({ title: 'Memories saved', description: `Successfully saved ${saved} memories` });
      setPhase('success');
    } catch (error) {
      console.error('Confirm memories error:', error);
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save memories',
        variant: 'destructive',
      });
    } finally {
      setIsConfirming(false);
    }
  }, [generatedMemories, createMemory, selectedDoc, toast, getSession]);

  const resetToReady = useCallback(() => {
    setGeneratedMemories([]);
    setSelectedDoc(null);
    setSavedCount(0);
    setPhase('ready');
  }, []);

  const reset = useCallback(() => {
    setPhase('auth-check');
    setConfig(null);
    setGeneratedMemories([]);
    setSelectedDoc(null);
    setSavedCount(0);
  }, []);

  return {
    phase, setPhase, config, stats, isLoading, isActivating, isPolling,
    isSearching, searchResults, isSaving,
    generatedMemories, selectedDoc, isConfirming, savedCount,
    loadConfig, activateMonitoring, deactivateMonitoring,
    searchDocs, generateFromDoc,
    updateMemory, deleteMemory, toggleEdit, updateTag,
    confirmMemories, resetToReady, reset,
  };
}
