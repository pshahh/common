'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface ThreadPost {
  id: string;
  title: string;
  location: string;
  expires_at: string | null;
}

interface Thread {
  id: string;
  post_id: string;
  participant_ids: string[];
  created_at: string;
  closed_at: string | null;
  last_message_at: string | null;
  post: ThreadPost | null;
  otherParticipantName: string | null;
  hasUnread: boolean;
}

interface MobileMessageListProps {
  userId: string;
  onSelectThread: (threadId: string) => void;
  onClose: () => void;
  refreshTrigger?: number;
}

export default function MobileMessageList({
  userId,
  onSelectThread,
  refreshTrigger = 0,
}: MobileMessageListProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchThreads() {
      const { data, error } = await supabase
        .from('threads')
        .select(`
          id,
          post_id,
          participant_ids,
          created_at,
          closed_at,
          last_message_at,
          posts (
            id,
            title,
            location,
            expires_at
          )
        `)
        .contains('participant_ids', [userId])
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) {
        console.error('Error fetching threads:', error);
        setLoading(false);
        return;
      }

      if (!data) {
        setLoading(false);
        return;
      }

      // Fetch read timestamps for all threads in one query
      const threadIds = data.map((t) => t.id);
      const { data: readData } = await supabase
        .from('thread_reads')
        .select('thread_id, last_read_at')
        .eq('user_id', userId)
        .in('thread_id', threadIds);

      const readMap: Record<string, string> = {};
      if (readData) {
        readData.forEach((r) => {
          readMap[r.thread_id] = r.last_read_at;
        });
      }

      // Collect all other participant IDs across all threads
      const otherParticipantIds = new Set<string>();
      data.forEach((thread) => {
        thread.participant_ids.forEach((id: string) => {
          if (id !== userId) otherParticipantIds.add(id);
        });
      });

      // Fetch their names in one query
      let nameMap: Record<string, string> = {};
      if (otherParticipantIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name')
          .in('id', [...otherParticipantIds]);
        if (profiles) {
          profiles.forEach((p) => {
            nameMap[p.id] = p.first_name;
          });
        }
      }

      const transformedThreads: Thread[] = data.map((thread) => {
        const postData = thread.posts;
        const post: ThreadPost | null = Array.isArray(postData)
          ? postData[0] || null
          : postData;

        const otherIds = thread.participant_ids.filter((id: string) => id !== userId);
        const otherName = otherIds.length > 0 ? nameMap[otherIds[0]] || null : null;

        // Determine unread status
        const lastReadAt = readMap[thread.id];
        const lastMessageAt = thread.last_message_at;
        let hasUnread = false;
        if (lastMessageAt) {
          if (!lastReadAt) {
            hasUnread = true;
          } else {
            hasUnread = new Date(lastMessageAt) > new Date(lastReadAt);
          }
        }

        return {
          id: thread.id,
          post_id: thread.post_id,
          participant_ids: thread.participant_ids,
          created_at: thread.created_at,
          closed_at: thread.closed_at,
          last_message_at: thread.last_message_at,
          post: post,
          otherParticipantName: otherName,
          hasUnread,
        };
      });

      setThreads(transformedThreads);
      setLoading(false);
    }

    if (userId) {
      fetchThreads();
    }
  }, [userId, refreshTrigger]);

  const isThreadClosed = (thread: Thread): boolean => {
    if (thread.closed_at) return true;
    if (thread.post?.expires_at) {
      const expiresAt = new Date(thread.post.expires_at);
      const closeTime = new Date(expiresAt.getTime() + 24 * 60 * 60 * 1000);
      if (new Date() > closeTime) return true;
    }
    return false;
  };

  const sortedThreads = [...threads].sort((a, b) => {
    const aIsClosed = isThreadClosed(a);
    const bIsClosed = isThreadClosed(b);
    if (aIsClosed && !bIsClosed) return 1;
    if (!aIsClosed && bIsClosed) return -1;
    const aTime = a.last_message_at || a.created_at;
    const bTime = b.last_message_at || b.created_at;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });

  return (
    <div style={{
      position: 'fixed',
      top: '56px',
      left: 0,
      right: 0,
      bottom: '64px',
      background: '#FFFFFF',
      zIndex: 45,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      padding: '16px',
    }}>
      {loading ? (
        <div style={{
          textAlign: 'center',
          padding: '48px 24px',
          color: '#888888',
          fontSize: '14px',
        }}>
          Loading...
        </div>
      ) : sortedThreads.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '48px 24px',
          color: '#888888',
          fontSize: '14px',
          lineHeight: 1.5,
        }}>
          Messages appear here when it&apos;s time to coordinate.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sortedThreads.map((thread) => {
            const closed = isThreadClosed(thread);
            const unread = thread.hasUnread && !closed;

            return (
              <div
                key={thread.id}
                onClick={() => {
                  // Optimistically clear unread so dot doesn't flash on close
                  setThreads(prev => prev.map(t => 
                    t.id === thread.id ? { ...t, hasUnread: false } : t
                  ));
                  onSelectThread(thread.id);
                }}
                style={{
                  padding: '16px',
                  background: '#FFFFFF',
                  border: '1px solid #E0E0E0',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  opacity: closed ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '15px',
                    fontWeight: unread ? 600 : 500,
                    color: closed ? '#888888' : '#000000',
                    marginBottom: '4px',
                  }}>
                    {thread.post?.title || 'Unknown post'}
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: '#888888',
                    fontWeight: unread ? 500 : 400,
                  }}>
                    {thread.otherParticipantName || thread.post?.location || ''}
                  </div>
                  {closed && (
                    <div style={{
                      fontSize: '11px',
                      color: '#888888',
                      marginTop: '8px',
                      fontStyle: 'italic',
                    }}>
                      Conversation closed
                    </div>
                  )}
                </div>

                {/* Unread dot — right side */}
                {unread && (
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#1A1A1A',
                    flexShrink: 0,
                  }} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}