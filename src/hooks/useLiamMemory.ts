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
}

interface UseLiamMemoryReturn {
  createMemory: (content: string, tag?: string) => Promise<boolean>;
  listMemories: () => Promise<Memory[] | null>;
  isCreating: boolean;
  isListing: boolean;
}

export function useLiamMemory(): UseLiamMemoryReturn {
  const [isCreating, setIsCreating] = useState(false);
  const [isListing, setIsListing] = useState(false);

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
      return data.memories || data;
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

  return {
    createMemory,
    listMemories,
    isCreating,
    isListing,
  };
}
