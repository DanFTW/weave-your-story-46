import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLiamMemory } from "@/hooks/useLiamMemory";
import { EmailDumpPhase, Contact, ExtractedEmail, EmailMemory } from "@/types/emailDump";

interface UseEmailDumpReturn {
  phase: EmailDumpPhase;
  setPhase: (phase: EmailDumpPhase) => void;
  selectedEmails: string[];
  searchResults: Contact[];
  extractedEmails: EmailMemory[];
  savedCount: number;
  isSearching: boolean;
  isExtracting: boolean;
  isSaving: boolean;
  searchContacts: (query: string) => Promise<void>;
  selectEmail: (email: string) => void;
  deselectEmail: (email: string) => void;
  clearSelection: () => void;
  extractEmails: () => Promise<void>;
  removeExtractedEmail: (id: string) => void;
  updateExtractedEmail: (id: string, content: string) => void;
  updateExtractedEmailTag: (id: string, tag: string) => void;
  toggleEditingEmail: (id: string, isEditing: boolean) => void;
  saveAsMemories: () => Promise<boolean>;
  reset: () => void;
}

export function useEmailDump(): UseEmailDumpReturn {
  const { toast } = useToast();
  const { createMemory } = useLiamMemory();
  
  const [phase, setPhase] = useState<EmailDumpPhase>('auth-check');
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const [extractedEmails, setExtractedEmails] = useState<EmailMemory[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
        headers: { Authorization: `Bearer ${session.access_token}` },
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

  const selectEmail = useCallback((email: string) => {
    setSelectedEmails(prev => 
      prev.includes(email) ? prev : [...prev, email]
    );
  }, []);

  const deselectEmail = useCallback((email: string) => {
    setSelectedEmails(prev => prev.filter(e => e !== email));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedEmails([]);
    setSearchResults([]);
  }, []);

  const extractEmails = useCallback(async () => {
    if (selectedEmails.length === 0) return;

    setPhase('extracting');
    setIsExtracting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke('gmail-fetch-emails', {
        body: { emailAddresses: selectedEmails },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      const emails: ExtractedEmail[] = data?.emails || [];
      
      if (emails.length === 0) {
        toast({
          title: "No emails found",
          description: "No emails were found for the selected addresses.",
        });
        setPhase('contact-search');
        return;
      }

      // Convert to EmailMemory format
      const memories: EmailMemory[] = emails.map((email, index) => ({
        id: `email-${Date.now()}-${index}`,
        content: formatEmailAsMemory(email),
        tag: 'EMAIL',
        email,
        isEditing: false,
      }));

      setExtractedEmails(memories);
      setPhase('preview');
    } catch (error) {
      console.error('Extraction failed:', error);
      toast({
        title: "Extraction failed",
        description: "Could not fetch emails. Please try again.",
        variant: "destructive",
      });
      setPhase('contact-search');
    } finally {
      setIsExtracting(false);
    }
  }, [selectedEmails, toast]);

  const removeExtractedEmail = useCallback((id: string) => {
    setExtractedEmails(prev => prev.filter(e => e.id !== id));
  }, []);

  const updateExtractedEmail = useCallback((id: string, content: string) => {
    setExtractedEmails(prev => 
      prev.map(e => e.id === id ? { ...e, content, isEditing: false } : e)
    );
  }, []);

  const updateExtractedEmailTag = useCallback((id: string, tag: string) => {
    setExtractedEmails(prev => 
      prev.map(e => e.id === id ? { ...e, tag } : e)
    );
  }, []);

  const toggleEditingEmail = useCallback((id: string, isEditing: boolean) => {
    setExtractedEmails(prev => 
      prev.map(e => e.id === id ? { ...e, isEditing } : e)
    );
  }, []);

  const saveAsMemories = useCallback(async () => {
    setIsSaving(true);
    try {
      let saved = 0;
      for (const memory of extractedEmails) {
        const success = await createMemory(memory.content, memory.tag);
        if (success) saved++;
      }

      if (saved > 0) {
        setSavedCount(saved);
        setPhase('success');
        return true;
      }
      throw new Error('Failed to save memories');
    } catch (error) {
      console.error('Save failed:', error);
      toast({
        title: "Save failed",
        description: "Could not save memories. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [extractedEmails, createMemory, toast]);

  const reset = useCallback(() => {
    setPhase('auth-check');
    setSelectedEmails([]);
    setSearchResults([]);
    setExtractedEmails([]);
    setSavedCount(0);
  }, []);

  return {
    phase,
    setPhase,
    selectedEmails,
    searchResults,
    extractedEmails,
    savedCount,
    isSearching,
    isExtracting,
    isSaving,
    searchContacts,
    selectEmail,
    deselectEmail,
    clearSelection,
    extractEmails,
    removeExtractedEmail,
    updateExtractedEmail,
    updateExtractedEmailTag,
    toggleEditingEmail,
    saveAsMemories,
    reset,
  };
}

function formatEmailAsMemory(email: ExtractedEmail): string {
  const date = new Date(email.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  
  // Create a clean memory format
  const body = email.body || email.snippet;
  const cleanBody = body.replace(/\s+/g, ' ').trim().slice(0, 500);
  
  return `Email from ${email.from} on ${date}: "${email.subject}" - ${cleanBody}`;
}
