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
  post: ThreadPost | null;
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
  onClose,
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
          posts (
            id,
            title,
            location,
            expires_at
          )
        `)
        .contains('participant_ids', [userId])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching threads:', error);
      } else if (data) {
        const transformedThreads: Thread[] = data.map((thread) => {
          const postData = thread.posts;
          const post: ThreadPost | null = Array.isArray(postData) 
            ? postData[0] || null 
            : postData;

          return {
            id: thread.id,
            post_id: thread.post_id,
            participant_ids: thread.participant_ids,
            created_at: thread.created_at,
            closed_at: thread.closed_at,
            post: post,
          };
        });

        setThreads(transformedThreads);
      }

      setLoading(false);
    }

    if (userId) {
      fetchThreads();
    }
  }, [userId, refreshTrigger]);

  // Check if a thread is closed
  const isThreadClosed = (thread: Thread): boolean => {
    if (thread.closed_at) return true;
    if (thread.post?.expires_at) {
      const expiresAt = new Date(thread.post.expires_at);
      const closeTime = new Date(expiresAt.getTime() + 24 * 60 * 60 * 1000);
      if (new Date() > closeTime) return true;
    }
    return false;
  };

  // Sort threads: open threads first, then closed
  const sortedThreads = [...threads].sort((a, b) => {
    const aIsClosed = isThreadClosed(a);
    const bIsClosed = isThreadClosed(b);
    if (aIsClosed && !bIsClosed) return 1;
    if (!aIsClosed && bIsClosed) return -1;
    return 0;
  });

  return (
    <div className="mobile-message-overlay open">
      {/* Header */}
      <div className="mobile-thread-header">
        <button 
          className="mobile-thread-back"
          onClick={onClose}
        >
          ←
        </button>
        <span className="mobile-thread-title">Messages</span>
        <div style={{ width: '40px' }} /> {/* Spacer for alignment */}
      </div>

      {/* Thread list */}
      <div className="mobile-thread-content" style={{ padding: '16px' }}>
        {loading ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '48px 24px', 
            color: '#888',
            fontSize: '14px',
          }}>
            Loading...
          </div>
        ) : sortedThreads.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '48px 24px', 
            color: '#888',
            fontSize: '14px',
            lineHeight: 1.5,
          }}>
            Messages appear here when it's time to coordinate.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sortedThreads.map((thread) => {
              const closed = isThreadClosed(thread);
              return (
                <div
                  key={thread.id}
                  onClick={() => onSelectThread(thread.id)}
                  style={{
                    padding: '16px',
                    background: '#fff',
                    border: '1px solid #e0e0e0',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    opacity: closed ? 0.5 : 1,
                    transition: 'background 0.15s ease',
                  }}
                >
                  <div style={{
                    fontSize: '15px',
                    fontWeight: 500,
                    color: closed ? '#888' : '#000',
                    marginBottom: '4px',
                  }}>
                    {thread.post?.title || 'Unknown post'}
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: '#888',
                  }}>
                    {thread.post?.location || ''}
                  </div>
                  {closed && (
                    <div style={{
                      fontSize: '11px',
                      color: '#888',
                      marginTop: '8px',
                      fontStyle: 'italic',
                    }}>
                      Conversation closed
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}