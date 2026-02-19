import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SharedMemoryItem } from '@/types/memory';

interface UseSharedWithMeReturn {
  items: SharedMemoryItem[];
  isLoading: boolean;
  fetch: () => Promise<void>;
}

export function useSharedWithMe(): UseSharedWithMeReturn {
  const { user } = useAuth();
  const [items, setItems] = useState<SharedMemoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      // Fetch share recipient rows joined with parent memory_shares
      const { data: recipientRows, error } = await supabase
        .from('memory_share_recipients')
        .select(`
          id,
          share_id,
          recipient_email,
          viewed_at,
          memory_shares (
            id,
            memory_id,
            share_scope,
            custom_condition,
            thread_tag,
            share_token,
            owner_user_id,
            created_at
          )
        `)
        .or(`recipient_email.eq.${user.email},recipient_user_id.eq.${user.id}`)
        .order('created_at', { referencedTable: 'memory_shares', ascending: false });

      if (error) {
        console.error('[useSharedWithMe] query error:', error);
        setIsLoading(false);
        return;
      }

      if (!recipientRows || recipientRows.length === 0) {
        setItems([]);
        setIsLoading(false);
        return;
      }

      // Collect unique owner_user_ids for profile resolution
      const ownerIds = [
        ...new Set(
          recipientRows
            .map((r) => (r.memory_shares as any)?.owner_user_id)
            .filter(Boolean)
        ),
      ];

      // Fetch owner profiles
      const profileMap: Record<string, string | null> = {};
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', ownerIds);

        if (profiles) {
          for (const p of profiles) {
            profileMap[p.user_id] = p.full_name;
          }
        }
      }

      // Shape into SharedMemoryItem[]
      const shaped: SharedMemoryItem[] = recipientRows
        .map((r) => {
          const ms = r.memory_shares as any;
          if (!ms) return null;
          return {
            shareId: ms.id as string,
            shareToken: ms.share_token as string,
            memoryId: ms.memory_id as string,
            shareScope: ms.share_scope as 'single' | 'thread' | 'custom',
            customCondition: ms.custom_condition as string | null,
            threadTag: ms.thread_tag as string | null,
            ownerUserId: ms.owner_user_id as string,
            ownerName: profileMap[ms.owner_user_id] ?? null,
            sharedAt: ms.created_at as string,
            viewedAt: r.viewed_at,
          } satisfies SharedMemoryItem;
        })
        .filter((x): x is SharedMemoryItem => x !== null);

      setItems(shaped);
    } catch (e) {
      console.error('[useSharedWithMe] unexpected error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return { items, isLoading, fetch };
}
