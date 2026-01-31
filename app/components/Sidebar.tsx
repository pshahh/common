'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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

interface SidebarProps {
  userId: string;
  selectedThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onNavigateToMyActivity: () => void;
  onLogout: () => void;
  activeItem?: 'messages' | 'my-activity' | 'settings' | 'admin-reports' | 'admin-posts' | null;
  refreshTrigger?: number; // Increment this to trigger a refresh
}

export default function Sidebar({
  userId,
  selectedThreadId,
  onSelectThread,
  onNavigateToMyActivity,
  onLogout,
  activeItem = null,
  refreshTrigger = 0,
}: SidebarProps) {
  const router = useRouter();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingReportsCount, setPendingReportsCount] = useState(0);
  const [pendingPostsCount, setPendingPostsCount] = useState(0);

  // Check if user is admin and fetch pending counts
  useEffect(() => {
    async function checkAdminStatus() {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .single();

      if (!error && data?.is_admin) {
        setIsAdmin(true);

        // Fetch pending reports count
        const { count: reportsCount } = await supabase
          .from('reports')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        setPendingReportsCount(reportsCount || 0);

        // Fetch pending posts count
        const { count: postsCount } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        setPendingPostsCount(postsCount || 0);
      }
    }

    if (userId) {
      checkAdminStatus();
    }
  }, [userId]);

  const fetchThreads = useCallback(async () => {
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
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchThreads();
    }
  }, [userId, fetchThreads, refreshTrigger]);

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
            closed_at: string | null;
          };

          if (newThread.participant_ids.includes(userId)) {
            const { data: postData } = await supabase
              .from('posts')
              .select('id, title, location, expires_at')
              .eq('id', newThread.post_id)
              .single();

            if (postData) {
              const transformedThread: Thread = {
                id: newThread.id,
                post_id: newThread.post_id,
                participant_ids: newThread.participant_ids,
                created_at: newThread.created_at,
                closed_at: newThread.closed_at,
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

  // Check if a thread is closed
  const isThreadClosed = (thread: Thread): boolean => {
    if (thread.closed_at) return true;
    // Client-side check: if post expired + 24 hours has passed
    if (thread.post?.expires_at) {
      const expiresAt = new Date(thread.post.expires_at);
      const closeTime = new Date(expiresAt.getTime() + 24 * 60 * 60 * 1000);
      if (new Date() > closeTime) return true;
    }
    return false;
  };

  const NavItem = ({ 
    onClick, 
    isActive, 
    children,
    badge,
  }: { 
    onClick: () => void; 
    isActive: boolean; 
    children: React.ReactNode;
    badge?: number;
  }) => (
    <div
      onClick={onClick}
      style={{
        fontSize: '14px',
        color: isActive ? '#000' : '#444',
        fontWeight: isActive ? 500 : 400,
        padding: '10px 12px',
        borderRadius: '12px',
        cursor: 'pointer',
        background: isActive ? '#fff' : 'transparent',
        boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
        transition: 'background 0.15s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <span>{children}</span>
      {badge !== undefined && badge > 0 && (
        <span style={{
          fontSize: '11px',
          fontWeight: 600,
          color: '#D4594F',
          background: '#FBEEED',
          padding: '2px 8px',
          borderRadius: '10px',
          minWidth: '20px',
          textAlign: 'center',
        }}>
          {badge}
        </span>
      )}
    </div>
  );

  return (
    <div className="sidebar-container" style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Content - removed the toggle button area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 12px 0', overflowY: 'auto' }}>
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
              {[...threads]
                .sort((a, b) => {
                  // Sort open threads above closed ones
                  const aIsClosed = isThreadClosed(a);
                  const bIsClosed = isThreadClosed(b);
                  if (aIsClosed && !bIsClosed) return 1;
                  if (!aIsClosed && bIsClosed) return -1;
                  return 0;
                })
                .map((thread) => {
                  const closed = isThreadClosed(thread);
                  return (
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
                        opacity: closed ? 0.5 : 1,
                      }}
                    >
                      <div style={{
                        fontSize: '14px',
                        color: closed 
                          ? '#888' 
                          : selectedThreadId === thread.id ? '#000' : '#444',
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
                  );
                })}
            </div>
          )}
        </div>

        {/* My activity link */}
        <NavItem 
          onClick={handleMyActivityClick} 
          isActive={activeItem === 'my-activity'}
        >
          My activity
        </NavItem>

        {/* Admin section - only show for admins */}
        {isAdmin && (
          <>
            <div style={{
              fontSize: '11px',
              fontWeight: 500,
              color: '#888',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              padding: '0 12px',
              marginTop: '24px',
              marginBottom: '12px',
            }}>
              Admin
            </div>
            <NavItem 
              onClick={() => router.push('/admin/posts')} 
              isActive={activeItem === 'admin-posts'}
              badge={pendingPostsCount}
            >
              Post approval
            </NavItem>
            <NavItem 
              onClick={() => router.push('/admin/reports')} 
              isActive={activeItem === 'admin-reports'}
              badge={pendingReportsCount}
            >
              Reports
            </NavItem>
          </>
        )}

        {/* Spacer to push settings and logout to bottom */}
        <div style={{ flex: 1 }} />

        {/* Settings link */}
        <NavItem 
          onClick={() => router.push('/settings')} 
          isActive={activeItem === 'settings'}
        >
          Settings
        </NavItem>
      </div>

      {/* Logout at bottom */}
      <div style={{ padding: '8px 12px 16px' }}>
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