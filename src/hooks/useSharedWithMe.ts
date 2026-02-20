import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SharedMemoryItem } from '@/types/memory';

interface UseSharedWithMeReturn {
  items: SharedMemoryItem[];
  isLoading: boolean;
  fetch: () => Promise<void>;
}

export function useSharedWithMe(): UseSharedWithMeReturn {
  const [items, setItems] = useState<SharedMemoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = useCallback(async () => {
    // Get session directly from Supabase — never rely on useAuth() state timing
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    const userEmail = session?.user?.email;

    console.log('[useSharedWithMe] fetch called, session user:', userId, userEmail);

    if (!userId || !userEmail) {
      console.log('[useSharedWithMe] no session, aborting');
      return;
    }

    setIsLoading(true);
    try {
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
        .or(`recipient_email.eq.${userEmail},recipient_user_id.eq.${userId}`)
        .order('created_at', { referencedTable: 'memory_shares', ascending: false });

      console.log('[useSharedWithMe] query result:', { recipientRows, error });

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

      const ownerIds = [
        ...new Set(
          recipientRows
            .map((r) => (r.memory_shares as any)?.owner_user_id)
            .filter(Boolean)
        ),
      ];

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
  }, []); // no deps — reads session directly each time

  return { items, isLoading, fetch };
}
