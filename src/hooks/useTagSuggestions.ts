import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseTagSuggestionsReturn {
  suggestTags: (content: string) => Promise<string[]>;
  isLoading: boolean;
  cachedTags: string[];
}

// Simple in-memory cache for tag suggestions
const tagCache = new Map<string, string[]>();

/**
 * Hook for AI-powered tag suggestions.
 * Uses the generate-tags edge function to get contextual tag recommendations.
 * Includes debouncing and caching to minimize API calls.
 */
export function useTagSuggestions(): UseTagSuggestionsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [cachedTags, setCachedTags] = useState<string[]>([]);
  const lastRequestRef = useRef<string>('');

  const suggestTags = useCallback(async (content: string): Promise<string[]> => {
    if (!content || content.trim().length < 10) {
      return [];
    }

    const trimmedContent = content.trim();
    
    // Create a cache key from the first 100 chars
    const cacheKey = trimmedContent.substring(0, 100).toLowerCase();
    
    // Check cache first
    if (tagCache.has(cacheKey)) {
      const cached = tagCache.get(cacheKey)!;
      setCachedTags(cached);
      return cached;
    }

    // Skip if same request is already in flight
    if (lastRequestRef.current === cacheKey) {
      return cachedTags;
    }

    lastRequestRef.current = cacheKey;
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-tags', {
        body: { content: trimmedContent },
      });

      if (error) {
        console.error('Error getting tag suggestions:', error);
        return [];
      }

      const tags = data?.tags || [];
      
      // Cache the result
      tagCache.set(cacheKey, tags);
      setCachedTags(tags);
      
      return tags;
    } catch (err) {
      console.error('Unexpected error getting tag suggestions:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [cachedTags]);

  return {
    suggestTags,
    isLoading,
    cachedTags,
  };
}
