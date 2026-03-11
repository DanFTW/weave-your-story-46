import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

/**
 * Attempts to get a valid auth token, refreshing the session if needed.
 * Returns null if the session cannot be refreshed (user needs to re-login).
 */
async function getValidAuthToken(): Promise<string | null> {
  // First check current session
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return null;
  }
  
  // Check if token is close to expiry (within 60 seconds)
  const expiresAt = session.expires_at;
  const now = Math.floor(Date.now() / 1000);
  const isExpiringSoon = expiresAt && (expiresAt - now) < 60;
  
  if (isExpiringSoon) {
    console.log('Session expiring soon, attempting refresh...');
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError || !refreshData.session) {
      console.error('Failed to refresh session:', refreshError);
      return null;
    }
    
    console.log('Session refreshed successfully');
    return refreshData.session.access_token;
  }
  
  return session.access_token;
}

/**
 * Handles session expiration by signing out and showing appropriate message
 */
async function handleSessionExpired(): Promise<void> {
  toast({
    title: 'Session expired',
    description: 'Please sign in again to continue.',
    variant: 'destructive',
  });
  await supabase.auth.signOut();
}

/**
 * Checks if an error indicates session expiration (401)
 */
function isSessionExpiredError(error: any, data: any): boolean {
  const errorMessage = error?.message?.toLowerCase() || '';
  const dataError = data?.error?.toLowerCase() || '';
  
  return (
    errorMessage.includes('401') ||
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('jwt expired') ||
    errorMessage.includes('invalid token') ||
    dataError.includes('unauthorized') ||
    dataError.includes('jwt expired')
  );
}

/**
 * Custom hook for LIAM Memory API operations
 * 
 * Provides methods to create and list memories through the LIAM API
 * via the liam-memory edge function.
 * 
 * Includes automatic session refresh and retry logic for expired tokens.
 */

interface Memory {
  id: string;
  content: string;
  tag?: string;
  createdAt: string;
  category?: string;
  sensitivity?: string;
  /** Base64-encoded image data from LIAM API (for memories created with images) */
  imageDataBase64?: string | null;
  /** MIME type of the stored image (e.g., "image/jpeg") */
  imageMimeType?: string | null;
}

interface UseLiamMemoryReturn {
  createMemory: (content: string, tag?: string, options?: { silent?: boolean }) => Promise<boolean>;
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

  /**
   * Invokes an edge function with automatic retry on 401 errors.
   * Will attempt to refresh the session and retry once if a 401 is encountered.
   */
  const invokeWithRetry = async (
    body: Record<string, any>,
    retried: boolean = false
  ): Promise<{ data: any; error: any }> => {
    const { data, error } = await supabase.functions.invoke('liam-memory', { body });
    
    // If we get a 401-like error and haven't retried yet, try refreshing session
    if (!retried && isSessionExpiredError(error, data)) {
      console.log('Got 401 error, attempting session refresh and retry...');
      
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshData.session) {
        console.error('Session refresh failed, user needs to re-login');
        await handleSessionExpired();
        return { data: null, error: { message: 'Session expired' } };
      }
      
      console.log('Session refreshed, retrying request...');
      return invokeWithRetry(body, true);
    }
    
    return { data, error };
  };

  const createMemory = async (content: string, tag?: string, options?: { silent?: boolean }): Promise<boolean> => {
    const silent = options?.silent ?? false;
    setIsCreating(true);
    
    try {
      const token = await getValidAuthToken();
      if (!token) {
        await handleSessionExpired();
        return false;
      }

      const { data, error } = await invokeWithRetry({
        action: 'create',
        content,
        tag,
      });

      // Check for transport-level errors
      if (error) {
        console.error('Error creating memory (transport):', error);
        const errorMessage = error.message || 'Failed to save memory';
        const isConfigError = errorMessage.includes('API keys not configured') || errorMessage.includes('API keys incomplete');
        
        if (!silent) {
          toast({
            title: isConfigError ? 'API keys required' : 'Failed to save memory',
            description: isConfigError ? 'Please configure your API keys in Profile → API Configuration.' : errorMessage,
            variant: 'destructive',
          });
        }
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
        
        if (!silent) {
          toast({
            title: isConfigError ? 'API keys required' : 'Failed to save memory',
            description: isConfigError 
              ? 'Please configure your API keys in Profile → API Configuration.' 
              : typeof data.details === 'string' ? data.details : errorMessage,
            variant: 'destructive',
          });
        }
        return false;
      }

      // Verify we got a successful response from LIAM API
      // The API returns { success: true } or similar on success
      if (!data || (data.success === false)) {
        console.error('Unexpected response from LIAM API:', data);
        if (!silent) {
          toast({
            title: 'Failed to save memory',
            description: 'The memory service returned an unexpected response.',
            variant: 'destructive',
          });
        }
        return false;
      }

      console.log('Memory created successfully:', data);
      
      // Fire-and-forget: trigger restaurant bookmark sync + grocery sheet sync
      const memoryId = data?.data?.transactionNumber || data?.transactionNumber || `mem-${Date.now()}`;
      import('@/utils/triggerRestaurantBookmarkSync').then(({ triggerRestaurantBookmarkSync }) => {
        triggerRestaurantBookmarkSync(content, memoryId);
      }).catch(() => {});
      import('@/utils/triggerGrocerySheetSync').then(({ triggerGrocerySheetSync }) => {
        triggerGrocerySheetSync(content, memoryId);
      }).catch(() => {});

      if (!silent) {
        toast({
          title: 'Memory saved',
          description: 'Your memory has been stored.',
        });
      }
      return true;
    } catch (err) {
      console.error('Unexpected error creating memory:', err);
      if (!silent) {
        toast({
          title: 'Failed to save memory',
          description: 'An unexpected error occurred.',
          variant: 'destructive',
        });
      }
      return false;
    } finally {
      setIsCreating(false);
    }
  };

  const listMemories = async (): Promise<Memory[] | null> => {
    setIsListing(true);
    
    try {
      const token = await getValidAuthToken();
      if (!token) {
        await handleSessionExpired();
        return null;
      }

      const { data, error } = await invokeWithRetry({
        action: 'list',
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
      
      const seenIds = new Set<string>();
      const memories: Memory[] = rawMemories.map((m: any, index: number) => {
        let id = m.transactionNumber || m.queryHash || `memory-${index}`;
        // Ensure unique keys — LIAM can return multiple fragments per transactionNumber
        if (seenIds.has(id)) {
          id = `${id}-${index}`;
        }
        seenIds.add(id);
        return {
        id,
        content: m.memory || m.content || '',
        tag: m.notesKey || m.tag || undefined,
        createdAt: parseApiDate(m.date),
        category: m.category,
        sensitivity: m.sensitivity,
        // Image fields from LIAM API (for memories created with create-with-image)
        imageDataBase64: m.imageDataBase64 || m.image || null,
        imageMimeType: m.imageMimeType || m.imageType || null,
      };});
      
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
      const token = await getValidAuthToken();
      if (!token) {
        await handleSessionExpired();
        return false;
      }

      const { data, error } = await invokeWithRetry({
        action: 'forget',
        memoryId,
        permanent,
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
      const token = await getValidAuthToken();
      if (!token) {
        await handleSessionExpired();
        return false;
      }

      const { data, error } = await invokeWithRetry({
        action: 'changeTag',
        memoryId,
        tag: newTag,
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
