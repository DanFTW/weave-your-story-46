import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLiamMemory } from '@/hooks/useLiamMemory';
import { useToast } from '@/hooks/use-toast';
import { GeneratedMemory } from '@/types/flows';
import { WebsiteScrapePhase, WebsiteScrapeResult } from '@/types/websiteScrape';

export function useWebsiteScrape() {
  const [phase, setPhase] = useState<WebsiteScrapePhase>('input');
  const [generatedMemories, setGeneratedMemories] = useState<GeneratedMemory[]>([]);
  const [lastResult, setLastResult] = useState<WebsiteScrapeResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { createMemory } = useLiamMemory();
  const { toast } = useToast();

  const scrapeAndGenerate = useCallback(async (url: string) => {
    setPhase('scraping');

    try {
      // Step 1: Scrape the website
      const { data: scrapeData, error: scrapeError } = await supabase.functions.invoke('website-scrape', {
        body: { url },
      });

      if (scrapeError) throw new Error(scrapeError.message || 'Failed to scrape website');
      if (!scrapeData?.success) throw new Error(scrapeData?.error || 'Scraping returned no data');

      const { markdown, title } = scrapeData;
      if (!markdown || markdown.trim().length === 0) {
        throw new Error('No content found on this page');
      }

      setPhase('generating');

      // Step 2: Generate memories from scraped content
      // Truncate to ~12000 chars to stay within AI token limits
      const truncatedContent = markdown.length > 12000 
        ? markdown.substring(0, 12000) + '\n\n[Content truncated...]' 
        : markdown;

      const { data: genData, error: genError } = await supabase.functions.invoke('generate-memories', {
        body: {
          flowType: 'website-scrape',
          entryName: 'website content',
          entryNamePlural: 'website contents',
          entries: [{
            id: 'website-1',
            data: { content: truncatedContent, title: title || url },
            createdAt: new Date().toISOString(),
          }],
          memoryTag: 'WEBSITE',
        },
      });

      if (genError) throw new Error(genError.message || 'Failed to generate memories');
      if (!genData?.memories || genData.memories.length === 0) {
        throw new Error('Could not extract any memories from this content');
      }

      setGeneratedMemories(genData.memories as GeneratedMemory[]);
      setLastResult({ url, title: title || '', content: markdown, memoryCount: 0 });
      setPhase('preview');
    } catch (error) {
      console.error('Website scrape error:', error);
      toast({
        title: 'Extraction failed',
        description: error instanceof Error ? error.message : 'Failed to extract memories',
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
