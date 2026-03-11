import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLiamMemory } from '@/hooks/useLiamMemory';
import { useToast } from '@/hooks/use-toast';
import { GeneratedMemory } from '@/types/flows';
import { LinkedInProfileScrapePhase, LinkedInProfileScrapeResult } from '@/types/linkedinProfileScrape';

export function useLinkedInProfileScrape() {
  const [phase, setPhase] = useState<LinkedInProfileScrapePhase>('input');
  const [generatedMemories, setGeneratedMemories] = useState<GeneratedMemory[]>([]);
  const [lastResult, setLastResult] = useState<LinkedInProfileScrapeResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { createMemory } = useLiamMemory();
  const { toast } = useToast();

  const scrapeAndGenerate = useCallback(async (url: string) => {
    setPhase('scraping');

    try {
      const { data: scrapeData, error: scrapeError } = await supabase.functions.invoke('linkedin-profile-scrape', {
        body: { url },
      });

      if (scrapeError) throw new Error(scrapeError.message || 'Failed to scrape profile');
      if (!scrapeData?.success) throw new Error(scrapeData?.error || 'Scraping returned no data');

      const { content, name } = scrapeData;
      if (!content || content.trim().length === 0) {
        throw new Error('No profile data found');
      }

      setPhase('generating');

      const truncatedContent = content.length > 12000
        ? content.substring(0, 12000) + '\n\n[Content truncated...]'
        : content;

      const { data: genData, error: genError } = await supabase.functions.invoke('generate-memories', {
        body: {
          flowType: 'linkedin-profile',
          entryName: 'LinkedIn profile',
          entryNamePlural: 'LinkedIn profiles',
          entries: [{
            id: 'linkedin-1',
            data: { content: truncatedContent, title: name || url },
            createdAt: new Date().toISOString(),
          }],
          memoryTag: 'LINKEDIN',
        },
      });

      if (genError) throw new Error(genError.message || 'Failed to generate memories');
      if (!genData?.memories || genData.memories.length === 0) {
        throw new Error('Could not extract any memories from this profile');
      }

      setGeneratedMemories(genData.memories as GeneratedMemory[]);
      setLastResult({ url, name: name || '', memoryCount: 0 });
      setPhase('preview');
    } catch (error) {
      console.error('LinkedIn profile scrape error:', error);
      toast({
        title: 'Extraction failed',
        description: error instanceof Error ? error.message : 'Failed to extract profile data',
        variant: 'destructive',
      });
      setPhase('input');
    }
  }, [toast]);

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
    setIsSaving(true);
    const activeMemories = generatedMemories.filter(m => !m.isDeleted);

    try {
      let savedCount = 0;
      for (const memory of activeMemories) {
        const success = await createMemory(memory.content, memory.tag, { silent: true });
        if (success) savedCount++;
      }

      if (savedCount > 0) {
        setLastResult(prev => prev ? { ...prev, memoryCount: savedCount } : null);
        toast({
          title: 'Memories saved',
          description: `Successfully saved ${savedCount} memories`,
        });
        setPhase('success');
      } else {
        throw new Error('Failed to save any memories');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save memories',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [generatedMemories, createMemory, toast]);

  const reset = useCallback(() => {
    setPhase('input');
    setGeneratedMemories([]);
    setLastResult(null);
  }, []);

  return {
    phase,
    generatedMemories,
    lastResult,
    isSaving,
    scrapeAndGenerate,
    updateMemory,
    deleteMemory,
    toggleEdit,
    updateTag,
    confirmMemories,
    reset,
  };
}
