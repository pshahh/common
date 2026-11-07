import { supabase } from '@/lib/supabase';

// Latest message per thread, from get_thread_previews (one call for any
// number of threads). The function is SECURITY INVOKER, so it returns only
// what the messages RLS lets this user read in the thread itself.
export interface ThreadPreview {
  thread_id: string;
  sender_id: string;
  content: string;
  message_type: string | null;
  created_at: string | null;
  // Up to two most recent non-system senders other than the user, newest first
  recent_sender_ids: string[];
}

export async function fetchThreadPreviews(threadIds: string[]): Promise<Record<string, ThreadPreview>> {
  if (threadIds.length === 0) return {};
  const { data, error } = await supabase.rpc('get_thread_previews', { thread_ids: threadIds });
  if (error) {
    // The list still works without previews
    console.error('get_thread_previews failed:', error.message);
    return {};
  }
  const map: Record<string, ThreadPreview> = {};
  ((data || []) as ThreadPreview[]).forEach((row) => {
    map[row.thread_id] = { ...row, recent_sender_ids: row.recent_sender_ids || [] };
  });
  return map;
}

// Collects thread ids from realtime updates and fetches their previews in
// one call shortly after, so a burst of messages costs one request.
export function createPreviewRefresher(
  onPreviews: (previews: Record<string, ThreadPreview>) => void,
  delayMs = 300
) {
  const pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    queue(threadId: string) {
      pending.add(threadId);
      if (timer) return;
      timer = setTimeout(async () => {
        timer = null;
        const ids = [...pending];
        pending.clear();
        const previews = await fetchThreadPreviews(ids);
        if (Object.keys(previews).length > 0) onPreviews(previews);
      }, delayMs);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending.clear();
    },
  };
}
