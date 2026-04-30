'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Shared hook for unread thread count.
 * Drives the messages badge on BottomNav across all pages.
 *
 * Returns { unreadCount, refreshUnreadCount }.
 *
 * Automatically refreshes when:
 *  - userId changes (login/logout)
 *  - refreshTrigger changes (caller bumps it after closing a thread, leaving, etc.)
 *  - a realtime thread UPDATE is received (new message from someone else)
 */
export function useUnreadCount(
  userId: string | null | undefined,
  refreshTrigger: number = 0
) {
  const [unreadCount, setUnreadCount] = useState(0);
  // Keep userId in a ref so the realtime callback always sees the latest value
  const userIdRef = useRef(userId);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const refreshUnreadCount = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) {
      setUnreadCount(0);
      return;
    }

    const { data: userThreads } = await supabase
      .from('threads')
      .select('id, last_message_at')
      .contains('participant_ids', [uid]);

    if (!userThreads || userThreads.length === 0) {
      setUnreadCount(0);
      return;
    }

    const { data: reads } = await supabase
      .from('thread_reads')
      .select('thread_id, last_read_at')
      .eq('user_id', uid);

    const readMap = new Map<string, string>();
    (reads || []).forEach((r: { thread_id: string; last_read_at: string }) => {
      readMap.set(r.thread_id, r.last_read_at);
    });

    const count = userThreads.filter(
      (t: { id: string; last_message_at: string | null }) => {
        if (!t.last_message_at) return false;
        const lastRead = readMap.get(t.id);
        if (!lastRead) return true;
        return new Date(t.last_message_at) > new Date(lastRead);
      }
    ).length;

    setUnreadCount(count);
  }, []);

  // Refresh on userId change
  useEffect(() => {
    if (userId) {
      refreshUnreadCount();
    } else {
      setUnreadCount(0);
    }
  }, [userId, refreshUnreadCount]);

  // Refresh when caller bumps refreshTrigger
  useEffect(() => {
    if (userId && refreshTrigger > 0) {
      refreshUnreadCount();
    }
  }, [refreshTrigger, userId, refreshUnreadCount]);

  // Subscribe to thread updates so the badge lights up in real time
  // when a new message arrives (threads.last_message_at changes)
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`unread-badge-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'threads',
        },
        () => {
          // Small delay to let mark_thread_read / message insert settle
          setTimeout(() => refreshUnreadCount(), 300);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refreshUnreadCount]);

  return { unreadCount, refreshUnreadCount };
}