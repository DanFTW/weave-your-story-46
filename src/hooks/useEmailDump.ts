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

      console.log('Searching contacts for:', query);

      const { data, error } = await supabase.functions.invoke('gmail-search', {
        body: { query },
      });

      console.log('Search response:', { data, error });

      if (error) {
        console.error('Search function error:', error);
        throw error;
      }
      
      const contacts = data?.contacts || [];
      console.log(`Found ${contacts.length} contacts`);
      setSearchResults(contacts);
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

      console.log('Extracting emails for:', selectedEmails);

      const { data, error } = await supabase.functions.invoke('gmail-fetch-emails', {
        body: { emailAddresses: selectedEmails },
      });

      console.log('Extract response:', { data, error });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      const emails: ExtractedEmail[] = data?.emails || [];
      console.log(`Extracted ${emails.length} emails`);
      
      if (emails.length === 0) {
        toast({
          title: "No emails found",
          description: "No emails were found for the selected addresses.",
        });
        setPhase('contact-search');
        return;
      }

      // Convert to EmailMemory format with 'email' tag (lowercase to match tagConfig)
      const memories: EmailMemory[] = emails.map((email, index) => ({
        id: `email-${Date.now()}-${index}`,
        content: formatEmailAsMemory(email),
        tag: 'email',
        email,
        isEditing: false,
      }));

      console.log(`Created ${memories.length} memories`);
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
  
  // Handle snippet which may be an object in some cases
  let snippetText = email.snippet;
  if (typeof email.snippet === 'object' && email.snippet !== null) {
    // @ts-ignore - snippet might be an object from API
    snippetText = email.snippet.body || email.snippet.text || JSON.stringify(email.snippet);
  }
  
  // Create a clean memory format
  const body = email.body || snippetText || '';
  const cleanBody = String(body).replace(/\s+/g, ' ').trim().slice(0, 500);
  
  return `Email from ${email.from} on ${date}: "${email.subject}" - ${cleanBody}`;
}
