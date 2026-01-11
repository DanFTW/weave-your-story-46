import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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
  isCreating: boolean;
  isListing: boolean;
  isForgetting: boolean;
}

export function useLiamMemory(): UseLiamMemoryReturn {
  const [isCreating, setIsCreating] = useState(false);
  const [isListing, setIsListing] = useState(false);
  const [isForgetting, setIsForgetting] = useState(false);

  const createMemory = async (content: string, tag?: string): Promise<boolean> => {
    setIsCreating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('liam-memory', {
        body: {
          action: 'create',
          content,
          tag,
        },
      });

      if (error) {
        console.error('Error creating memory:', error);
        toast({
          title: 'Failed to save memory',
          description: error.message,
          variant: 'destructive',
        });
        return false;
      }

      console.log('Memory created successfully:', data);
      toast({
        title: 'Memory saved',
        description: 'Your memory has been stored successfully.',
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
      const { data, error } = await supabase.functions.invoke('liam-memory', {
        body: {
          action: 'list',
        },
      });

      if (error) {
        console.error('Error listing memories:', error);
        toast({
          title: 'Failed to load memories',
          description: error.message,
          variant: 'destructive',
        });
        return null;
      }

      console.log('Memories retrieved:', data);
      
      // Extract memories from nested API response structure
      const rawMemories = data?.data?.memories || data?.memories || [];
      
      // Transform API response to our Memory interface
      const memories: Memory[] = rawMemories.map((m: any, index: number) => ({
        id: m.transactionNumber || m.queryHash || `memory-${index}`,
        content: m.memory || m.content || '',
        tag: m.notesKey || m.tag || undefined,
        createdAt: parseApiDate(m.date),
        category: m.category,
        sensitivity: m.sensitivity,
      }));
      
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
      const { data, error } = await supabase.functions.invoke('liam-memory', {
        body: {
          action: 'forget',
          memoryId,
          permanent,
        },
      });

      if (error) {
        console.error('Error forgetting memory:', error);
        toast({
          title: 'Failed to forget memory',
          description: error.message,
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

  return {
    createMemory,
    listMemories,
    forgetMemory,
    isCreating,
    isListing,
    isForgetting,
  };
}
