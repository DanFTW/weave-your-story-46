import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from './use-toast';

interface UserApiKeys {
  api_key: string;
  private_key: string;
  user_key: string;
}

interface UseUserApiKeysReturn {
  keys: UserApiKeys | null;
  isLoading: boolean;
  isSaving: boolean;
  hasKeys: boolean;
  saveKeys: (keys: UserApiKeys) => Promise<boolean>;
  refreshKeys: () => Promise<void>;
}

export function useUserApiKeys(): UseUserApiKeysReturn {
  const { user } = useAuth();
  const [keys, setKeys] = useState<UserApiKeys | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchKeys = useCallback(async () => {
    if (!user?.id) {
      setKeys(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('user_api_keys')
        .select('api_key, private_key, user_key')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching API keys:', error);
        toast({
          title: 'Failed to load API keys',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      setKeys(data);
    } catch (err) {
      console.error('Unexpected error fetching keys:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const saveKeys = useCallback(async (newKeys: UserApiKeys): Promise<boolean> => {
    if (!user?.id) {
      toast({
        title: 'Not authenticated',
        description: 'Please sign in to save API keys.',
        variant: 'destructive',
      });
      return false;
    }

    // Validate private key format
    if (!newKeys.private_key.includes('-----BEGIN') || !newKeys.private_key.includes('-----END')) {
      toast({
        title: 'Invalid private key format',
        description: 'Private key must be in PEM format with BEGIN/END headers.',
        variant: 'destructive',
      });
      return false;
    }

    setIsSaving(true);

    try {
      // Use upsert for cleaner insert-or-update logic
      const { error } = await supabase
        .from('user_api_keys')
        .upsert(
          {
            user_id: user.id,
            api_key: newKeys.api_key,
            private_key: newKeys.private_key,
            user_key: newKeys.user_key,
          },
          { 
            onConflict: 'user_id',
            ignoreDuplicates: false 
          }
        );

      if (error) {
        console.error('Error saving API keys:', error);
        toast({
          title: 'Failed to save API keys',
          description: error.message,
          variant: 'destructive',
        });
        return false;
      }

      setKeys(newKeys);
      return true;
    } catch (err) {
      console.error('Unexpected error saving keys:', err);
      toast({
        title: 'Failed to save API keys',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [user?.id]);

  return {
    keys,
    isLoading,
    isSaving,
    hasKeys: !!keys,
    saveKeys,
    refreshKeys: fetchKeys,
  };
}