'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatPreview, formatRowTime } from '@/lib/messageTime';
import { createPreviewRefresher, fetchThreadPreviews, type ThreadPreview } from '@/lib/threadPreviews';

interface ThreadPost {
  id: string;
  title: string;
  location: string;
  expires_at: string | null;
  status: string | null;
}

interface Thread {
  id: string;
  post_id: string;
  participant_ids: string[];
  created_at: string;
  last_message_at: string | null;
  thread_type: string;
  post: ThreadPost | null;
  hasUnread: boolean;
  preview: ThreadPreview | null;
}

interface PersonSummary {
  first_name: string;
  avatar_url: string | null;
}

interface MobileMessageListProps {
  userId: string;
  onSelectThread: (threadId: string) => void;
  onClose: () => void;
  refreshTrigger?: number;
  // People the user has just blocked. Their threads disappear before the refetch lands.
  hiddenUserIds?: Set<string>;
  // The thread open on top of this list, if any. While set, the list is
  // hidden underneath it: realtime updates keep ordering current but skip
  // preview fetches (the list refetches when the thread closes), and the
  // open thread never shows an unread dot.
  activeThreadId?: string | null;
}

function Initial({ name, size, fontSize, style }: { name: string; size: number; fontSize: number; style?: React.CSSProperties }) {
  return (
    <span style={{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      background: 'var(--pill-fill)',
      color: 'var(--text-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: `${fontSize}px`,
      fontWeight: 500,
      boxSizing: 'border-box',
      ...style,
    }}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function PersonCircle({ person, size, fontSize, style }: { person: PersonSummary | undefined; size: number; fontSize: number; style?: React.CSSProperties }) {
  const name = person?.first_name || '?';
  if (person?.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={person.avatar_url}
        alt=""
        style={{ width: `${size}px`, height: `${size}px`, borderRadius: '50%', objectFit: 'cover', display: 'block', boxSizing: 'border-box', ...style }}
      />
    );
  }
  return <Initial name={name} size={size} fontSize={fontSize} style={style} />;
}

export default function MobileMessageList({
  userId,
  onSelectThread,
  refreshTrigger = 0,
  hiddenUserIds,
  activeThreadId = null,
}: MobileMessageListProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [people, setPeople] = useState<Record<string, PersonSummary>>({});
  const [loading, setLoading] = useState(true);
  const activeThreadIdRef = useRef(activeThreadId);
  const threadIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  useEffect(() => {
    threadIdsRef.current = new Set(threads.map(t => t.id));
  }, [threads]);

  useEffect(() => {
    let cancelled = false;

    async function fetchThreads() {
      const { data, error } = await supabase
        .from('threads')
        .select(`
          id,
          post_id,
          participant_ids,
          created_at,
          last_message_at,
          thread_type,
          posts (
            id,
            title,
            location,
            expires_at,
            status
          )
        `)
        .contains('participant_ids', [userId])
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (cancelled) return;

      if (error) {
        console.error('Error fetching threads:', error);
        setLoading(false);
        return;
      }

      if (!data) {
        setLoading(false);
        return;
      }

      const threadIds = data.map((t) => t.id);
      const otherParticipantIds = new Set<string>();
      data.forEach((thread) => {
        thread.participant_ids.forEach((id: string) => {
          if (id !== userId) otherParticipantIds.add(id);
        });
      });

      // Read times, participant profiles and previews only need the thread
      // ids, so they run together.
      const [readResult, profileResult, previews] = await Promise.all([
        supabase
          .from('thread_reads')
          .select('thread_id, last_read_at')
          .eq('user_id', userId)
          .in('thread_id', threadIds),
        otherParticipantIds.size > 0
          ? supabase.from('profiles').select('id, first_name, avatar_url').in('id', [...otherParticipantIds])
          : Promise.resolve({ data: [] as { id: string; first_name: string; avatar_url: string | null }[] }),
        fetchThreadPreviews(threadIds),
      ]);

      if (cancelled) return;

      const readMap: Record<string, string> = {};
      (readResult.data || []).forEach((r) => {
        readMap[r.thread_id] = r.last_read_at;
      });

      const peopleMap: Record<string, PersonSummary> = {};
      const addPeople = (rows: { id: string; first_name: string; avatar_url: string | null }[] | null) => {
        (rows || []).forEach((p) => {
          peopleMap[p.id] = { first_name: p.first_name, avatar_url: p.avatar_url };
        });
      };
      addPeople(profileResult.data);

      // Senders who have since left a thread aren't participants any more
      const missing = new Set<string>();
      Object.values(previews).forEach((p) => {
        [p.sender_id, ...p.recent_sender_ids].forEach((id) => {
          if (id !== userId && !peopleMap[id]) missing.add(id);
        });
      });
      if (missing.size > 0) {
        const { data: extra } = await supabase.from('profiles').select('id, first_name, avatar_url').in('id', [...missing]);
        if (cancelled) return;
        addPeople(extra);
      }

      const transformedThreads: Thread[] = data.map((thread) => {
        const postData = thread.posts;
        const post: ThreadPost | null = Array.isArray(postData)
          ? postData[0] || null
          : postData;

        const lastReadAt = readMap[thread.id];
        const lastMessageAt = thread.last_message_at;
        let hasUnread = false;
        if (lastMessageAt) {
          hasUnread = !lastReadAt || new Date(lastMessageAt) > new Date(lastReadAt);
        }

        return {
          id: thread.id,
          post_id: thread.post_id,
          participant_ids: thread.participant_ids,
          created_at: thread.created_at,
          last_message_at: thread.last_message_at,
          thread_type: thread.thread_type || '1:1',
          post,
          hasUnread,
          preview: previews[thread.id] || null,
        };
      });

      setPeople(peopleMap);
      setThreads(transformedThreads);
      setLoading(false);
    }

    if (userId) {
      fetchThreads();
    }
    return () => {
      cancelled = true;
    };
  }, [userId, refreshTrigger]);

  // Keep ordering and previews live. A thread's last_message_at changes on
  // every new message; refetch just that thread's preview (batched).
  useEffect(() => {
    if (!userId) return;
    const refresher = createPreviewRefresher((previews) => {
      setThreads((prev) => prev.map((t) => (previews[t.id] ? { ...t, preview: previews[t.id] } : t)));
    });
    const channel = supabase
      .channel(`mobile-thread-updates-${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'threads' },
        (payload) => {
          const updated = payload.new as { id: string; last_message_at: string | null };
          if (!threadIdsRef.current.has(updated.id)) return;
          setThreads((prev) => prev.map((t) => {
            if (t.id !== updated.id) return t;
            const changed = updated.last_message_at !== t.last_message_at;
            return {
              ...t,
              last_message_at: updated.last_message_at,
              hasUnread: activeThreadIdRef.current === t.id ? false : (changed || t.hasUnread),
            };
          }));
          // Hidden under an open thread: the list refetches when it closes
          if (!activeThreadIdRef.current) refresher.queue(updated.id);
        }
      )
      .subscribe();
    return () => {
      refresher.cancel();
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const visibleThreads = hiddenUserIds && hiddenUserIds.size > 0
    ? threads.filter(t => !t.participant_ids.some(id => id !== userId && hiddenUserIds.has(id)))
    : threads;

  const sortedThreads = [...visibleThreads].sort((a, b) => {
    const aTime = a.last_message_at || a.created_at;
    const bTime = b.last_message_at || b.created_at;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });

  // The thread itself never closes, but once the post is closed or its event
  // has passed it's no longer live -- grey it out in the list so past and
  // upcoming chats are easy to tell apart at a glance. Presentation only:
  // greyed threads still open and send normally.
  const isEventEnded = (thread: Thread): boolean => {
    if (thread.post?.status === 'closed') return true;
    if (!thread.post?.expires_at) return false;
    return new Date(thread.post.expires_at) < new Date();
  };

  const now = new Date();

  const renderAvatar = (thread: Thread) => {
    const others = thread.participant_ids.filter(id => id !== userId && !hiddenUserIds?.has(id));
    if (thread.thread_type !== 'group') {
      const person = others[0] ? people[others[0]] : undefined;
      return <PersonCircle person={person} size={44} fontSize={17} style={{ flexShrink: 0 }} />;
    }
    // Two most recent other senders, topped up from the other participants
    const ids: string[] = [];
    [...(thread.preview?.recent_sender_ids || []), ...others].forEach((id) => {
      if (ids.length < 2 && !ids.includes(id) && !hiddenUserIds?.has(id)) ids.push(id);
    });
    if (ids.length < 2) {
      return <PersonCircle person={ids[0] ? people[ids[0]] : undefined} size={44} fontSize={17} style={{ flexShrink: 0 }} />;
    }
    return (
      <div style={{ position: 'relative', width: '44px', height: '44px', flexShrink: 0 }}>
        <PersonCircle person={people[ids[0]]} size={30} fontSize={13} style={{ position: 'absolute', top: 0, left: 0 }} />
        <PersonCircle
          person={people[ids[1]]}
          size={30}
          fontSize={13}
          style={{ position: 'absolute', right: 0, bottom: 0, border: '2px solid var(--bg-badge)' }}
        />
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: '64px',
      background: 'var(--bg-badge)',
      zIndex: 45,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Brand bar - this overlay sits above the page's own <Header>, so it
          needs its own "common" wordmark to stay consistent with the home
          feed and activity pages. */}
      <div style={{
        padding: '12px 16px',
        paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: '20px',
          fontWeight: 700,
          color: 'var(--accent)',
          letterSpacing: '-0.5px',
        }}>
          common
        </span>
      </div>
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
      }}>
      {loading ? (
        <div style={{
          textAlign: 'center',
          padding: '48px 24px',
          color: 'var(--text-secondary)',
          fontSize: '14px',
        }}>
          Loading...
        </div>
      ) : sortedThreads.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '48px 24px',
          color: 'var(--text-secondary)',
          fontSize: '14px',
          lineHeight: 1.5,
        }}>
          Messages appear here when it&apos;s time to coordinate.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {sortedThreads.map((thread) => {
            const unread = thread.hasUnread && thread.id !== activeThreadId;
            const ended = isEventEnded(thread);
            const isGroup = thread.thread_type === 'group';
            const otherId = thread.participant_ids.find(id => id !== userId);
            const otherName = otherId ? people[otherId]?.first_name : undefined;
            const title = thread.post?.title || 'Unknown post';
            const previewText = thread.preview
              ? formatPreview(thread.preview, {
                  currentUserId: userId,
                  isGroup,
                  senderFirstName: people[thread.preview.sender_id]?.first_name,
                })
              : 'No messages yet';

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
                  padding: '12px 0',
                  background: 'var(--bg-badge)',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  opacity: ended ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                {renderAvatar(thread)}

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Line 1: name and title, time on the right */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <div style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: '15px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {!isGroup && otherName ? (
                        <>
                          <span style={{ color: 'var(--text-primary)', fontWeight: unread ? 600 : 500 }}>{otherName}</span>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}> · {title}</span>
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-primary)', fontWeight: unread ? 600 : 500 }}>{title}</span>
                      )}
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flexShrink: 0 }}>
                      {formatRowTime(thread.last_message_at || thread.created_at, now)}
                    </span>
                  </div>

                  {/* Line 2: preview, unread dot on the right */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                    <div style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: '14px',
                      color: unread ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: unread ? 500 : 400,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {previewText}
                    </div>
                    {/* Unread dot; grey once the event has ended */}
                    {unread && (
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: ended ? 'var(--text-secondary)' : 'var(--accent)',
                        flexShrink: 0,
                      }} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
