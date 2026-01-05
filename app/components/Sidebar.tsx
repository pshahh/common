'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface ThreadPost {
  id: string;
  title: string;
  location: string;
}

interface Thread {
  id: string;
  post_id: string;
  participant_ids: string[];
  created_at: string;
  post: ThreadPost | null;
}

interface SidebarProps {
  userId: string;
  selectedThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onNavigateToMyActivity: () => void;
  onLogout: () => void;
  activeItem?: 'messages' | 'my-activity' | 'settings' | null;
}

export default function Sidebar({
  userId,
  selectedThreadId,
  onSelectThread,
  onNavigateToMyActivity,
  onLogout,
  activeItem = null,
}: SidebarProps) {
  const router = useRouter();
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
          posts (
            id,
            title,
            location
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
  }, [userId]);

  // Subscribe to new threads for this user
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`user-threads-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'threads',
        },
        async (payload) => {
          const newThread = payload.new as { 
            id: string; 
            participant_ids: string[]; 
            post_id: string;
            created_at: string;
          };
          
          if (newThread.participant_ids.includes(userId)) {
            const { data: postData } = await supabase
              .from('posts')
              .select('id, title, location')
              .eq('id', newThread.post_id)
              .single();

            if (postData) {
              const transformedThread: Thread = {
                id: newThread.id,
                post_id: newThread.post_id,
                participant_ids: newThread.participant_ids,
                created_at: newThread.created_at,
                post: postData,
              };
              setThreads((prev) => {
                if (prev.some(t => t.id === newThread.id)) return prev;
                return [transformedThread, ...prev];
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const handleMyActivityClick = () => {
    router.push('/my-activity');
    onNavigateToMyActivity();
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Toggle area */}
      <div style={{ padding: '16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          style={{
            background: 'none',
            border: 'none',
            fontSize: '16px',
            color: '#888',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '6px',
          }}
        >
          «
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 12px', overflowY: 'auto' }}>
        {/* Messages section */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 500,
            color: '#888',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            padding: '0 12px',
            marginBottom: '12px',
          }}>
            Messages
          </div>
          {loading ? (
            <div style={{ fontSize: '13px', color: '#888', padding: '8px 12px' }}>
              Loading...
            </div>
          ) : threads.length === 0 ? (
            <div style={{ fontSize: '13px', color: '#888', padding: '8px 12px', lineHeight: 1.5 }}>
              Messages appear here when it's time to coordinate.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {threads.map((thread) => (
                <div
                  key={thread.id}
                  onClick={() => onSelectThread(thread.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    background: selectedThreadId === thread.id ? '#fff' : 'transparent',
                    boxShadow: selectedThreadId === thread.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <div style={{
                    fontSize: '14px',
                    color: selectedThreadId === thread.id ? '#000' : '#444',
                    fontWeight: selectedThreadId === thread.id ? 500 : 400,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginBottom: '2px',
                  }}>
                    {thread.post?.title || 'Unknown post'}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#888',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {thread.post?.location || ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My activity link */}
        <div
          onClick={handleMyActivityClick}
          style={{
            fontSize: '14px',
            color: activeItem === 'my-activity' ? '#000' : '#444',
            fontWeight: activeItem === 'my-activity' ? 500 : 400,
            padding: '10px 12px',
            borderRadius: '12px',
            cursor: 'pointer',
            background: activeItem === 'my-activity' ? '#fff' : 'transparent',
            boxShadow: activeItem === 'my-activity' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            transition: 'background 0.15s ease',
          }}
        >
          My activity
        </div>

        {/* Settings link */}
        <div
          onClick={() => router.push('/settings')}
          style={{
            fontSize: '14px',
            color: activeItem === 'settings' ? '#000' : '#444',
            fontWeight: activeItem === 'settings' ? 500 : 400,
            padding: '10px 12px',
            borderRadius: '12px',
            cursor: 'pointer',
            background: activeItem === 'settings' ? '#fff' : 'transparent',
            boxShadow: activeItem === 'settings' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            transition: 'background 0.15s ease',
            marginTop: '4px',
          }}
        >
          Settings
        </div>
      </div>

      {/* Logout at bottom */}
      <div style={{ padding: '16px 12px', borderTop: '1px solid #f0f0f0' }}>
        <button
          onClick={onLogout}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '14px',
            color: '#888',
            cursor: 'pointer',
            padding: '10px 12px',
            width: '100%',
            textAlign: 'left',
            borderRadius: '12px',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#444'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#888'}
        >
          Log out
        </button>
      </div>
    </div>
  );
}