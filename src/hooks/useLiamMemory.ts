import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/**
 * Custom hook for LIAM Memory API operations
 * 
 * Provides methods to create and list memories through the LIAM API
 * via the liam-memory edge function.
 */

interface Memory {
  id: string;
  content: string;
  tag?: string;
  createdAt: string;
  category?: string;
  sensitivity?: string;
}

interface UseLiamMemoryReturn {
  createMemory: (content: string, tag?: string) => Promise<boolean>;
  listMemories: () => Promise<Memory[] | null>;
  forgetMemory: (memoryId: string, permanent?: boolean) => Promise<boolean>;
  changeTag: (memoryId: string, newTag: string) => Promise<boolean>;
  isCreating: boolean;
  isListing: boolean;
  isForgetting: boolean;
  isChangingTag: boolean;
}

export function useLiamMemory(): UseLiamMemoryReturn {
  const [isCreating, setIsCreating] = useState(false);
  const [isListing, setIsListing] = useState(false);
  const [isForgetting, setIsForgetting] = useState(false);
  const [isChangingTag, setIsChangingTag] = useState(false);

  const createMemory = async (content: string, tag?: string): Promise<boolean> => {
    setIsCreating(true);
    
    try {
      const token = await getAuthToken();
      if (!token) {
        toast({
          title: 'Sign in required',
          description: 'Please sign in to save memories.',
          variant: 'destructive',
        });
        return false;
      }

      const { data, error } = await supabase.functions.invoke('liam-memory', {
        body: {
          action: 'create',
          content,
          tag,
        },
      });

      // Check for transport-level errors
      if (error) {
        console.error('Error creating memory (transport):', error);
        const errorMessage = error.message || 'Failed to save memory';
        const isConfigError = errorMessage.includes('API keys not configured') || errorMessage.includes('API keys incomplete');
        
        toast({
          title: isConfigError ? 'API keys required' : 'Failed to save memory',
          description: isConfigError ? 'Please configure your API keys in Profile → API Configuration.' : errorMessage,
          variant: 'destructive',
        });
        return false;
      }

      // CRITICAL: Check for API-level errors in response body
      // The edge function returns { error: '...' } when LIAM API fails
      if (data?.error) {
        console.error('Error creating memory (API):', data.error, data.details);
        const errorMessage = data.message || data.error || 'Failed to save memory';
        const isConfigError = errorMessage.includes('API keys not configured') || 
                             errorMessage.includes('API keys incomplete') ||
                             errorMessage.includes('Invalid private key');
        
        toast({
          title: isConfigError ? 'API keys required' : 'Failed to save memory',
          description: isConfigError 
            ? 'Please configure your API keys in Profile → API Configuration.' 
            : typeof data.details === 'string' ? data.details : errorMessage,
          variant: 'destructive',
        });
        return false;
      }

      // Verify we got a successful response from LIAM API
      // The API returns { success: true } or similar on success
      if (!data || (data.success === false)) {
        console.error('Unexpected response from LIAM API:', data);
        toast({
          title: 'Failed to save memory',
          description: 'The memory service returned an unexpected response.',
          variant: 'destructive',
        });
        return false;
      }

      console.log('Memory created successfully:', data);
      toast({
        title: 'Memory saved',
        description: 'Your memory has been stored.',
      });
      return true;
    } catch (err) {
      console.error('Unexpected error creating memory:', err);
      toast({
        title: 'Failed to save memory',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsCreating(false);
    }
  };

  const listMemories = async (): Promise<Memory[] | null> => {
    setIsListing(true);
    
    try {
      const token = await getAuthToken();
      if (!token) {
        toast({
          title: 'Sign in required',
          description: 'Please sign in to view memories.',
          variant: 'destructive',
        });
        return null;
      }

      const { data, error } = await supabase.functions.invoke('liam-memory', {
        body: {
          action: 'list',
        },
      });

      // Check for transport-level errors
      if (error) {
        console.error('Error listing memories (transport):', error);
        const errorMessage = error.message || 'Failed to load memories';
        const isConfigError = errorMessage.includes('API keys not configured') || errorMessage.includes('API keys incomplete');
        
        toast({
          title: isConfigError ? 'API keys required' : 'Failed to load memories',
          description: isConfigError ? 'Please configure your API keys in Profile → API Configuration.' : errorMessage,
          variant: 'destructive',
        });
        return null;
      }

      // CRITICAL: Check for API-level errors in response body
      if (data?.error) {
        console.error('Error listing memories (API):', data.error, data.details);
        const errorMessage = data.message || data.error || 'Failed to load memories';
        const isConfigError = errorMessage.includes('API keys not configured') || 
                             errorMessage.includes('API keys incomplete') ||
                             errorMessage.includes('Invalid private key');
        
        toast({
          title: isConfigError ? 'API keys required' : 'Failed to load memories',
          description: isConfigError 
            ? 'Please configure your API keys in Profile → API Configuration.' 
            : typeof data.details === 'string' ? data.details : errorMessage,
          variant: 'destructive',
        });
        return null;
      }

      console.log('Memories retrieved:', data);
      console.log('Total active memories:', data?.data?.totalActiveMemories);
      
      // Extract memories from nested API response structure
      const rawMemories = data?.data?.memories || data?.memories || [];
      console.log('Raw memories count:', rawMemories.length);
      
      // Transform API response to our Memory interface
      const memories: Memory[] = rawMemories.map((m: any, index: number) => ({
        id: m.transactionNumber || m.queryHash || `memory-${index}`,
        content: m.memory || m.content || '',
        tag: m.notesKey || m.tag || undefined,
        createdAt: parseApiDate(m.date),
        category: m.category,
        sensitivity: m.sensitivity,
      }));
      
      console.log('Transformed memories count:', memories.length);
      return memories;
    } catch (err) {
      console.error('Unexpected error listing memories:', err);
      toast({
        title: 'Failed to load memories',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsListing(false);
    }
  };
  
  // Parse API date format "MM/DD/YYYY HH:mm:ss" to ISO string
  function parseApiDate(dateStr: string): string {
    if (!dateStr) return new Date().toISOString();
    
    try {
      // Handle "01/11/2026 17:15:11" format
      const [datePart, timePart] = dateStr.split(' ');
      const [month, day, year] = datePart.split('/');
      const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart || '00:00:00'}Z`;
      return new Date(isoDate).toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  const forgetMemory = async (memoryId: string, permanent: boolean = false): Promise<boolean> => {
    setIsForgetting(true);
    
    try {
      const token = await getAuthToken();
      if (!token) {
        toast({
          title: 'Sign in required',
          description: 'Please sign in to manage memories.',
          variant: 'destructive',
        });
        return false;
      }

      const { data, error } = await supabase.functions.invoke('liam-memory', {
        body: {
          action: 'forget',
          memoryId,
          permanent,
        },
      });

      // Check for transport-level errors
      if (error) {
        console.error('Error forgetting memory (transport):', error);
        toast({
          title: 'Failed to forget memory',
          description: error.message,
          variant: 'destructive',
        });
        return false;
      }

      // CRITICAL: Check for API-level errors in response body
      if (data?.error) {
        console.error('Error forgetting memory (API):', data.error, data.details);
        toast({
          title: 'Failed to forget memory',
          description: data.message || data.error || 'The memory service returned an error.',
          variant: 'destructive',
        });
        return false;
      }

      console.log('Memory forgotten successfully:', data);
      toast({
        title: 'Memory forgotten',
        description: 'The memory has been removed.',
      });
      return true;
    } catch (err) {
      console.error('Unexpected error forgetting memory:', err);
      toast({
        title: 'Failed to forget memory',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsForgetting(false);
    }
  };

  const changeTag = async (memoryId: string, newTag: string): Promise<boolean> => {
    setIsChangingTag(true);
    
    try {
      const token = await getAuthToken();
      if (!token) {
        toast({
          title: 'Sign in required',
          description: 'Please sign in to manage memories.',
          variant: 'destructive',
        });
        return false;
      }

      const { data, error } = await supabase.functions.invoke('liam-memory', {
        body: {
          action: 'changeTag',
          memoryId,
          tag: newTag,
        },
      });

      // Check for transport-level errors
      if (error) {
        console.error('Error changing tag (transport):', error);
        toast({
          title: 'Failed to update tag',
          description: error.message,
          variant: 'destructive',
        });
        return false;
      }

      // CRITICAL: Check for API-level errors in response body
      if (data?.error) {
        console.error('Error changing tag (API):', data.error, data.details);
        toast({
          title: 'Failed to update tag',
          description: data.message || data.error || 'The memory service returned an error.',
          variant: 'destructive',
        });
        return false;
      }

      console.log('Tag changed successfully:', data);
      toast({
        title: 'Tag updated',
        description: 'Memory tag has been updated.',
      });
      return true;
    } catch (err) {
      console.error('Unexpected error changing tag:', err);
      toast({
        title: 'Failed to update tag',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsChangingTag(false);
    }
  };

  return {
    createMemory,
    listMemories,
    forgetMemory,
    changeTag,
    isCreating,
    isListing,
    isForgetting,
    isChangingTag,
  };
}
