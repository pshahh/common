'use client';

import { Fragment, useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateAge, getInitials } from '@/lib/profile';
import ClosedBadge from './ClosedBadge';
import { renderTextWithLinks } from '@/lib/textUtils';
import { ExternalLink as ShareIcon } from 'lucide-react';
import posthog from 'posthog-js';
import ReactableBubble, { type Reaction } from './MessageReactions';
import BlockUserModal from './BlockUserModal';
import BlockMemberPicker, { type BlockCandidate } from './BlockMemberPicker';
import { dayKey, formatClockTime, formatDayLabel, formatFullTime } from '@/lib/messageTime';

// "Ana", "Ana and Sam", "Ana, Sam and Kai", "Ana, Sam, Kai and 2 others".
function formatNameList(names: string[]): string {
  if (names.length <= 1) return names[0] || '';
  if (names.length <= 3) return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const rest = names.length - 3;
  return `${names.slice(0, 3).join(', ')} and ${rest} ${rest === 1 ? 'other' : 'others'}`;
}

// A new cluster starts after a gap longer than this.
const CLUSTER_GAP_MS = 10 * 60 * 1000;

// Slim "common" wordmark bar, styled to match Header.tsx, shown only when
// this thread is the full-screen mobile view (the page's own <Header> is
// hidden underneath it otherwise).
function BrandBar({ show }: { show: boolean }) {
  if (!show) return null;
  return (
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
  );
}

// Mobile back control for the full-screen thread. Replaces the desktop ×.
function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back to chats"
      style={{
        width: '44px',
        height: '44px',
        margin: '-10px 4px -10px -14px',
        padding: 0,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}

interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  message_type?: string;
  sender_name?: string;
  sender_avatar_url?: string | null;
  sender_date_of_birth?: string | null;
}

interface Post {
  id: string;
  title: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  time: string;
  notes: string | null;
  name: string;
  preference: string | null;
  expires_at: string | null;
  user_id: string;
  status: string;
  slug: string | null;
}

interface Thread {
  id: string;
  post_id: string;
  participant_ids: string[];
  thread_type: string;
  post: Post | null;
}

interface ProfileData {
  first_name: string;
  avatar_url: string | null;
  date_of_birth: string | null;
}

interface MessageThreadProps {
  threadId: string;
  currentUserId: string;
  onClose: () => void;
  onReport?: (postId: string, threadId: string) => void;
  onLeaveThread?: () => void;
  // Called with the blocked person's id right after blocking them from this thread
  onUserBlocked?: (userId: string) => void;
  // People blocked elsewhere (e.g. from a post menu). If anyone else in the
  // thread is one of them, the thread closes itself.
  blockedUserIds?: Set<string>;
  // True when this is rendered as a full-screen mobile overlay, where the
  // page's own <Header> (with the "common" wordmark) is hidden underneath.
  // Adds a slim brand bar so the page still feels consistent with the home
  // feed and activity pages. Not needed for the desktop side-panel usage,
  // where the page's Header is already visible above it.
  showBrandHeader?: boolean;
}

export default function MessageThread({
  threadId,
  currentUserId,
  onClose,
  onReport,
  onLeaveThread,
  onUserBlocked,
  blockedUserIds,
  showBrandHeader = false,
}: MessageThreadProps) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hoveredAvatarId, setHoveredAvatarId] = useState<string | null>(null);
  const [expandedPhoto, setExpandedPhoto] = useState<{ url: string; name: string; age: number | null } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [profileCache, setProfileCache] = useState<Record<string, ProfileData>>({});
  // Reactions keyed by message id. Ids starting with 'tmp-' are optimistic.
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  const reactingRef = useRef<Set<string>>(new Set());
  
  // Modal states for Leave/Block
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  // Who the block confirmation is for. In a group with several other members
  // the picker chooses; otherwise it's the one other person.
  const [blockTarget, setBlockTarget] = useState<BlockCandidate | null>(null);
  const [blockCandidates, setBlockCandidates] = useState<BlockCandidate[] | null>(null);
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);
  // Set once the thread has been left or closed after a block, so it only happens once
  const leftAfterBlockRef = useRef(false);
  const [threadNotesExpanded, setThreadNotesExpanded] = useState(false);
  // Participants the current user has blocked (from blocked_users), left out of the header names.
  const [blockedParticipantIds, setBlockedParticipantIds] = useState<Set<string>>(new Set());


  // Everyone in the thread except the current user
  const getOtherParticipantIds = (): string[] => {
    if (!thread) return [];
    return thread.participant_ids.filter(id => id !== currentUserId);
  };

  const leaveAfterBlock = () => {
    if (leftAfterBlockRef.current) return;
    leftAfterBlockRef.current = true;
    if (onLeaveThread) {
      onLeaveThread();
    } else {
      onClose();
    }
  };

  // Someone in the thread was blocked from somewhere else while it is open.
  // block_user removes the blocker from every thread the blocked person is in.
  useEffect(() => {
    if (getOtherParticipantIds().some(id => blockedUserIds?.has(id))) {
      leaveAfterBlock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockedUserIds, thread]);

  const getProfileData = async (userId: string): Promise<ProfileData> => {
    if (profileCache[userId]) {
      return profileCache[userId];
    }
    const { data } = await supabase
      .from('profiles')
      .select('first_name, avatar_url, date_of_birth')
      .eq('id', userId)
      .single();
    const profile: ProfileData = {
      first_name: data?.first_name || 'Unknown',
      avatar_url: data?.avatar_url || null,
      date_of_birth: data?.date_of_birth || null,
    };
    setProfileCache(prev => ({ ...prev, [userId]: profile }));
    return profile;
  };

  // Helper to mark thread as read with error logging
  const markThreadAsRead = async () => {
    const { error } = await supabase.rpc('mark_thread_read', { thread_id_param: threadId });
    if (error) {
      console.error('mark_thread_read failed:', error);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function fetchThreadData() {
      setLoading(true);
      setMessages([]);
      setReactions({});

      const { data: threadData, error: threadError } = await supabase
        .from('threads')
        .select(`
          id,
          post_id,
          participant_ids,
          thread_type,
          posts (
            id,
            title,
            location,
            latitude,
            longitude,
            time,
            notes,
            name,
            preference,
            expires_at,
            user_id,
            status,
            slug
          )
        `)
        .eq('id', threadId)
        .single();

      if (!isMounted) return;

      if (threadError) {
        console.error('Error fetching thread:', threadError);
        setLoading(false);
        return;
      }

      // Check if the current user is still a participant
      if (!threadData.participant_ids.includes(currentUserId)) {
        setThread(null);
        setLoading(false);
        return;
      }

      const postData = threadData.posts;
      const post: Post | null = Array.isArray(postData) ? postData[0] || null : postData;

      setThread({
        id: threadData.id,
        post_id: threadData.post_id,
        participant_ids: threadData.participant_ids,
        thread_type: threadData.thread_type || '1:1',
        post: post,
      });

      const otherIds = threadData.participant_ids.filter((id: string) => id !== currentUserId);

      // Messages, participant blocks, and every profile the header and
      // bubbles need, in parallel. One batched profiles query replaces the
      // old per-sender lookups.
      const [messagesResult, blocksResult] = await Promise.all([
        supabase
          .from('messages')
          .select('id, thread_id, sender_id, content, created_at, message_type, message_reactions(id, message_id, user_id, emoji)')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: true }),
        otherIds.length > 0
          ? supabase
              .from('blocked_users')
              .select('blocked_user_id')
              .eq('user_id', currentUserId)
              .in('blocked_user_id', otherIds)
          : Promise.resolve({ data: [] as { blocked_user_id: string }[] }),
      ]);
      const { data: messagesData, error: messagesError } = messagesResult;

      if (!isMounted) return;

      setBlockedParticipantIds(new Set((blocksResult.data || []).map((b) => b.blocked_user_id)));

      if (messagesError) {
        console.error('Error fetching messages:', messagesError.message);
        setLoading(false);
        return;
      }

      const profileIds = new Set<string>(threadData.participant_ids);
      (messagesData || []).forEach((m) => {
        profileIds.add(m.sender_id);
        (m.message_reactions || []).forEach((r: { user_id: string }) => profileIds.add(r.user_id));
      });
      const profileMap: Record<string, ProfileData> = {};
      if (profileIds.size > 0) {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, first_name, avatar_url, date_of_birth')
          .in('id', [...profileIds]);
        if (!isMounted) return;
        (profileRows || []).forEach((p) => {
          profileMap[p.id] = {
            first_name: p.first_name || 'Unknown',
            avatar_url: p.avatar_url || null,
            date_of_birth: p.date_of_birth || null,
          };
        });
        setProfileCache(prev => ({ ...prev, ...profileMap }));
      }

      if (messagesData && messagesData.length > 0) {
        const transformedMessages: Message[] = messagesData.map((msg) => ({
          id: msg.id,
          thread_id: msg.thread_id,
          sender_id: msg.sender_id,
          content: msg.content,
          created_at: msg.created_at,
          message_type: msg.message_type || 'user',
          sender_name: profileMap[msg.sender_id]?.first_name || 'Unknown',
          sender_avatar_url: profileMap[msg.sender_id]?.avatar_url,
          sender_date_of_birth: profileMap[msg.sender_id]?.date_of_birth,
        }));

        setMessages(transformedMessages);

        // Reactions arrive embedded in the messages query (no N+1). Reactor
        // names came with the batched profiles query above.
        const reactionMap: Record<string, Reaction[]> = {};
        messagesData.forEach((msg) => {
          const list = (msg.message_reactions || []) as Reaction[];
          if (list.length > 0) reactionMap[msg.id] = list;
        });
        setReactions(reactionMap);
      }

      setLoading(false);

      // Mark thread as read when opened
      markThreadAsRead();
    }

    fetchThreadData();

    return () => {
      isMounted = false;
    };
  }, [threadId]);

  // Insert/update from realtime: one reaction per (message, user), so replace
  // any existing entry for that pair (this also swaps out our optimistic row).
  const applyReactionChange = (row: Reaction & { thread_id: string }) => {
    if (row.thread_id !== threadId) return;
    if (row.user_id !== currentUserId) getProfileData(row.user_id);
    setReactions((prev) => {
      const list = (prev[row.message_id] || []).filter(
        (r) => r.id !== row.id && r.user_id !== row.user_id
      );
      return {
        ...prev,
        [row.message_id]: [
          ...list,
          { id: row.id, message_id: row.message_id, user_id: row.user_id, emoji: row.emoji },
        ],
      };
    });
  };

  useEffect(() => {
    const channelName = `messages-thread-${threadId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${threadId}`,
        },
        async (payload) => {
          const newMsg = payload.new as {
            id: string;
            thread_id: string;
            sender_id: string;
            content: string;
            created_at: string;
          };

          if (newMsg.thread_id !== threadId) {
            return;
          }

          const profile = await getProfileData(newMsg.sender_id);
          const transformedMessage: Message = {
            ...newMsg,
            message_type: (newMsg as any).message_type || 'user',
            sender_name: profile.first_name,
            sender_avatar_url: profile.avatar_url,
            sender_date_of_birth: profile.date_of_birth,
          };

          setMessages((prev) => {
            if (prev.some(m => m.id === newMsg.id)) {
              return prev;
            }
            return [...prev, transformedMessage];
          });

          // Mark thread as read since user is viewing it
          markThreadAsRead();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_reactions', filter: `thread_id=eq.${threadId}` },
        (payload) => applyReactionChange(payload.new as Reaction & { thread_id: string })
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'message_reactions', filter: `thread_id=eq.${threadId}` },
        (payload) => applyReactionChange(payload.new as Reaction & { thread_id: string })
      )
      // DELETE events can't be filtered by thread and carry only the row id,
      // so match on id; ids from other threads simply won't be found.
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const id = (payload.old as { id?: string }).id;
          if (!id) return;
          setReactions((prev) => {
            let changed = false;
            const next: Record<string, Reaction[]> = {};
            for (const [mid, list] of Object.entries(prev)) {
              const filtered = list.filter((r) => r.id !== id);
              if (filtered.length !== list.length) changed = true;
              if (filtered.length > 0) next[mid] = filtered;
            }
            return changed ? next : prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Per-message layout: day separators and cluster edges. A cluster is a run
  // of messages from one sender, broken by a system message, a new day, or a
  // gap over CLUSTER_GAP_MS. Worked out once per messages change.
  const messageLayout = useMemo(() => {
    const now = new Date();
    const breaksBetween = (a: Message | undefined, b: Message | undefined): boolean => {
      if (!a || !b) return true;
      if (a.message_type === 'system' || b.message_type === 'system') return true;
      if (a.sender_id !== b.sender_id) return true;
      if (dayKey(a.created_at) !== dayKey(b.created_at)) return true;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime() > CLUSTER_GAP_MS;
    };
    return messages.map((msg, idx) => {
      const prev = messages[idx - 1];
      const next = messages[idx + 1];
      const newDay = !prev || dayKey(prev.created_at) !== dayKey(msg.created_at);
      return {
        dayLabel: newDay ? formatDayLabel(msg.created_at, now) : null,
        isFirstInCluster: breaksBetween(prev, msg),
        isLastInCluster: breaksBetween(msg, next),
        clockTime: formatClockTime(msg.created_at),
        fullTime: formatFullTime(msg.created_at, now),
      };
    });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);

    const { error } = await supabase.from('messages').insert({
      thread_id: threadId,
      sender_id: currentUserId,
      content: newMessage.trim(),
    }).select();

    if (error) {
      console.error('Error sending message:', error.message);
      alert('Failed to send message. Please try again.');
    } else {
      setNewMessage('');
      posthog.capture('message_sent', { thread_type: thread?.thread_type });
      // Mark as read after sending own message
      markThreadAsRead();
    }

    setSending(false);
  };

  const nameFor = (userId: string): string => {
    if (userId === currentUserId) return 'You';
    return profileCache[userId]?.first_name || 'Someone';
  };

  const setMyReaction = (messageId: string, mine: Reaction | null) => {
    setReactions((prev) => {
      const list = (prev[messageId] || []).filter((r) => r.user_id !== currentUserId);
      const next = mine ? [...list, mine] : list;
      const copy = { ...prev };
      if (next.length > 0) copy[messageId] = next;
      else delete copy[messageId];
      return copy;
    });
  };

  // Tap same emoji = remove, different = replace, none yet = add. Optimistic,
  // rolled back if the write fails.
  const handleReact = async (msg: Message, emoji: string) => {
    if (msg.sender_id === currentUserId || msg.message_type === 'system') return;
    if (reactingRef.current.has(msg.id)) return;

    const previous = (reactions[msg.id] || []).find((r) => r.user_id === currentUserId) || null;
    const action: 'added' | 'removed' | 'changed' =
      !previous ? 'added' : previous.emoji === emoji ? 'removed' : 'changed';

    reactingRef.current.add(msg.id);
    if (action === 'removed') {
      setMyReaction(msg.id, null);
    } else {
      setMyReaction(msg.id, {
        id: previous?.id || `tmp-${msg.id}`,
        message_id: msg.id,
        user_id: currentUserId,
        emoji,
      });
    }

    let errorMessage: string | null = null;
    if (action === 'removed') {
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', msg.id)
        .eq('user_id', currentUserId);
      if (error) errorMessage = error.message;
    } else {
      const { data, error } = await supabase
        .from('message_reactions')
        .upsert(
          { message_id: msg.id, thread_id: threadId, user_id: currentUserId, emoji },
          { onConflict: 'message_id,user_id' }
        )
        .select('id, message_id, user_id, emoji')
        .single();
      if (error) errorMessage = error.message;
      else if (data) setMyReaction(msg.id, data as Reaction);
    }

    reactingRef.current.delete(msg.id);

    if (errorMessage) {
      console.error('Error saving reaction:', errorMessage);
      setMyReaction(msg.id, previous);
      return;
    }

    posthog.capture('message_reacted', {
      emoji,
      action,
      thread_type: thread?.thread_type === 'group' ? 'group' : '1:1',
    });
  };

  const getMapUrl = () => {
    if (!thread?.post) return '#';
    const { latitude, longitude, location } = thread.post;
    if (latitude && longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  };

  const handleShare = async () => {
    if (!thread?.post) return;
    const postPath = thread.post.slug || thread.post.id;
    const url = `${window.location.origin}/post/${postPath}`;

    // Prefer the native share sheet where available (most mobile browsers,
    // and the Capacitor WebView on Android/iOS).
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: thread.post.title, url });
      } catch {
        // User cancelled the share sheet, or it failed - nothing to do.
      }
      return;
    }

    // Fallback for browsers without the Web Share API: copy to clipboard
    // and show an explicit confirmation.
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeaveThread = async () => {
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc('leave_thread', {
        thread_id_param: threadId
      });
      if (error) {
        console.error('Error leaving thread:', JSON.stringify(error, null, 2));
        alert('Failed to leave conversation. Please try again.');
        setActionLoading(false);
        return;
      }
      setShowLeaveModal(false);
      setActionLoading(false);
      if (onLeaveThread) {
        onLeaveThread();
      } else {
        onClose();
      }
    } catch (err) {
      console.error('Error leaving thread:', err);
      alert('Failed to leave conversation. Please try again.');
      setActionLoading(false);
    }
  };

  // In a group with several other members, ask who to block first. Never
  // guess: picking the first participant once blocked the wrong person.
  const handleBlockMenuClick = async () => {
    const otherIds = getOtherParticipantIds();
    if (otherIds.length === 0) return;
    setBlockError(null);
    if (otherIds.length === 1) {
      const profile = await getProfileData(otherIds[0]);
      setBlockTarget({ id: otherIds[0], firstName: profile.first_name });
      return;
    }
    setBlockCandidates(null);
    setShowBlockPicker(true);
    const people = await Promise.all(otherIds.map(async (id) => {
      const profile = await getProfileData(id);
      return { id, firstName: profile.first_name };
    }));
    setBlockCandidates(people);
  };

  const handleBlockUser = async () => {
    if (!blockTarget) return;
    const otherUserId = blockTarget.id;
    setActionLoading(true);
    setBlockError(null);
    try {
      const { error } = await supabase.rpc('block_user', {
        blocked_id: otherUserId
      });
      if (error) {
        console.error('Error blocking user:', JSON.stringify(error, null, 2));
        setBlockError('Failed to block this person. Please try again.');
        setActionLoading(false);
        return;
      }
      setBlockTarget(null);
      setActionLoading(false);
      onUserBlocked?.(otherUserId);
      leaveAfterBlock();
    } catch (err) {
      console.error('Error blocking user:', err);
      setBlockError('Failed to block this person. Please try again.');
      setActionLoading(false);
    }
  };


  const MessageAvatar = ({ 
    senderId, 
    senderName, 
    avatarUrl, 
    dateOfBirth,
    showAvatar 
  }: { 
    senderId: string; 
    senderName: string; 
    avatarUrl?: string | null;
    dateOfBirth?: string | null;
    showAvatar: boolean;
  }) => {
    if (!showAvatar) {
      return <div style={{ width: '28px', height: '28px', flexShrink: 0 }} />;
    }

    const age = dateOfBirth ? calculateAge(dateOfBirth) : null;

    if (avatarUrl) {
      return (
        <div 
          style={{ position: 'relative' }}
          onMouseEnter={() => setHoveredAvatarId(senderId)}
          onMouseLeave={() => setHoveredAvatarId(null)}
        >
          <img
            src={avatarUrl}
            alt={senderName}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              objectFit: 'cover',
              flexShrink: 0,
              cursor: 'pointer',
            }}
            onClick={() => setExpandedPhoto({ url: avatarUrl, name: senderName, age })}
          />
          {hoveredAvatarId === senderId && age && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '4px',
              background: 'var(--tooltip-bg)',
              color: 'var(--text-inverse)',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              whiteSpace: 'nowrap',
              zIndex: 30,
            }}>
              {senderName}, {age}
            </div>
          )}
        </div>
      );
    }

    return (
      <div style={{
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        background: 'var(--bg-badge)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: '11px',
        color: 'var(--text-secondary)',
        fontWeight: 500,
      }}>
        {getInitials(senderName)}
      </div>
    );
  };

  const ExpandedPhotoModal = () => {
    if (!expandedPhoto) return null;
    return (
      <div 
        onClick={() => setExpandedPhoto(null)}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, cursor: 'pointer',
        }}
      >
        <div onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
          <img
            src={expandedPhoto.url}
            alt={expandedPhoto.name}
            style={{
              maxWidth: '280px', maxHeight: '280px', borderRadius: '16px',
              objectFit: 'cover', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          />
          <div style={{ color: 'var(--text-inverse)', marginTop: '12px', fontSize: '14px', fontWeight: 500 }}>
            {expandedPhoto.name}{expandedPhoto.age ? `, ${expandedPhoto.age}` : ''}
          </div>
        </div>
      </div>
    );
  };

  const LeaveConversationModal = () => {
    if (!showLeaveModal) return null;
    return (
      <div 
        onClick={() => !actionLoading && setShowLeaveModal(false)}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}
      >
        <div onClick={(e) => e.stopPropagation()} style={{
          background: 'var(--bg-card)', borderRadius: '16px', padding: '24px',
          maxWidth: '340px', width: '100%', margin: '0 16px',
        }}>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
            Leave this chat?
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '20px', lineHeight: 1.5 }}>
            {thread?.thread_type === 'group'
              ? 'You\u2019ll leave this group chat. You can rejoin from the post.'
              : 'This closes the chat for both of you'}
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowLeaveModal(false)}
              disabled={actionLoading}
              style={{
                padding: '10px 20px', borderRadius: '20px', fontSize: '14px',
                fontWeight: 500, border: '1px solid var(--border)', background: 'var(--bg-card)',
                cursor: actionLoading ? 'not-allowed' : 'pointer', color: 'var(--text-primary)',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleLeaveThread}
              disabled={actionLoading}
              style={{
                padding: '10px 20px', borderRadius: '20px', fontSize: '14px',
                fontWeight: 500, border: 'none', background: 'var(--accent)',
                cursor: actionLoading ? 'not-allowed' : 'pointer',
                color: 'var(--text-inverse)', opacity: actionLoading ? 0.6 : 1,
              }}
            >
              {actionLoading ? 'Leaving...' : 'Leave'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <BrandBar show={showBrandHeader} />
        <div style={{
          padding: '16px',
          paddingTop: showBrandHeader ? '16px' : 'calc(16px + env(safe-area-inset-top, 0px))',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          {showBrandHeader && <BackButton onClick={onClose} />}
          <span style={{ fontSize: '16px', fontWeight: 600, flex: 1 }}>Loading...</span>
          {!showBrandHeader && (
            <button onClick={onClose} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: '18px',
              color: 'var(--text-secondary)', cursor: 'pointer', width: '36px', height: '36px',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
          )}
        </div>
      </div>
    );
  }

  if (!thread || !thread.post) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <BrandBar show={showBrandHeader} />
        <div style={{
          padding: '16px',
          paddingTop: showBrandHeader ? '16px' : 'calc(16px + env(safe-area-inset-top, 0px))',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          {showBrandHeader && <BackButton onClick={onClose} />}
          <span style={{ fontSize: '16px', fontWeight: 600, flex: 1 }}>Conversation unavailable</span>
          {!showBrandHeader && (
            <button onClick={onClose} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: '18px',
              color: 'var(--text-secondary)', cursor: 'pointer', width: '36px', height: '36px',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
          )}
        </div>
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}>
          <p style={{
            fontSize: '14px',
            color: 'var(--text-tertiary)',
            textAlign: 'center',
            lineHeight: 1.5,
          }}>
            This conversation is no longer available. The other person may have left.
          </p>
        </div>
      </div>
    );
  }

  const post = thread.post;

  // Header people. 1:1: the other participant. Group: everyone else's first
  // name, minus anyone the user has blocked.
  const isGroupHeader = thread.thread_type === 'group';
  const otherIds = getOtherParticipantIds();
  const otherProfile: ProfileData | undefined = otherIds[0] ? profileCache[otherIds[0]] : undefined;
  const otherFirstName = otherProfile?.first_name || 'Someone';
  const groupNames = formatNameList(
    otherIds
      .filter(id => !blockedUserIds?.has(id) && !blockedParticipantIds.has(id))
      .map(id => profileCache[id]?.first_name)
      .filter((name): name is string => !!name && name !== 'Unknown')
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <ExpandedPhotoModal />
      <LeaveConversationModal />
      {showBlockPicker && (
        <BlockMemberPicker
          people={blockCandidates}
          onCancel={() => setShowBlockPicker(false)}
          onSelect={(person) => { setShowBlockPicker(false); setBlockTarget(person); }}
        />
      )}
      {blockTarget && (
        <BlockUserModal
          title={getOtherParticipantIds().length > 1 ? `Block ${blockTarget.firstName}?` : undefined}
          loading={actionLoading}
          error={blockError}
          onCancel={() => { setBlockTarget(null); setBlockError(null); }}
          onConfirm={handleBlockUser}
        />
      )}
      <BrandBar show={showBrandHeader} />
      {/* Header */}
      <div style={{
        padding: '16px',
        paddingTop: showBrandHeader ? '16px' : 'calc(16px + env(safe-area-inset-top, 0px))',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        {showBrandHeader && <BackButton onClick={onClose} />}
        {isGroupHeader ? (
          <div style={{ flex: 1, minWidth: 0, marginRight: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{post.title}</span>
              {post.status === 'closed' && <ClosedBadge size="small" />}
            </div>
            {groupNames && (
              <div style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginTop: '2px',
              }}>
                {groupNames}
              </div>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px', marginRight: '8px' }}>
            <button
              type="button"
              onClick={() => {
                if (otherProfile?.avatar_url) {
                  setExpandedPhoto({
                    url: otherProfile.avatar_url,
                    name: otherProfile.first_name,
                    age: otherProfile.date_of_birth ? calculateAge(otherProfile.date_of_birth) : null,
                  });
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                minWidth: 0,
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: otherProfile?.avatar_url ? 'pointer' : 'default',
                fontFamily: 'inherit',
                textAlign: 'left',
              }}
            >
              {otherProfile?.avatar_url ? (
                <img
                  src={otherProfile.avatar_url}
                  alt=""
                  style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <span style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'var(--pill-fill)',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 500,
                  flexShrink: 0,
                }}>
                  {otherFirstName.charAt(0).toUpperCase()}
                </span>
              )}
              <span style={{
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 0,
              }}>
                {otherFirstName}
              </span>
            </button>
            {post.status === 'closed' && <ClosedBadge size="small" />}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              style={{
                background: 'none', border: 'none', fontSize: '18px', color: 'var(--accent)',
                cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >⋯</button>
            {showMenu && (
              <div style={{
                position: 'absolute', right: 0, top: '36px', background: 'var(--bg-card)',
                border: '1px solid var(--border)', borderRadius: '12px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: '176px',
                zIndex: 20, overflow: 'hidden',
              }}>
                <div
                  onClick={async () => {
                    if (typeof navigator.share === 'function') {
                      setShowMenu(false);
                      handleShare();
                    } else {
                      await handleShare();
                      setTimeout(() => setShowMenu(false), 1200);
                    }
                  }}
                  style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--text-primary)', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <ShareIcon size={14} />
                  {copied ? '✓ Copied!' : 'Share'}
                </div>
                <div
                  onClick={() => { setShowMenu(false); if (post) onReport?.(post.id, threadId); }}
                  style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--text-primary)', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                >
                  Report post
                </div>
                <div
                  onClick={() => { setShowMenu(false); setShowLeaveModal(true); }}
                  style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--text-primary)', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                >
                  Leave chat
                </div>
                <div
                  onClick={() => { setShowMenu(false); handleBlockMenuClick(); }}
                  style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--danger)', cursor: 'pointer' }}
                >
                  {getOtherParticipantIds().length > 1 ? 'Block someone' : 'Block this person'}
                </div>
              </div>
            )}
          </div>
          {!showBrandHeader && (
            <button onClick={onClose} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: '18px',
              color: 'var(--text-secondary)', cursor: 'pointer', width: '36px', height: '36px',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}>×</button>
          )}
        </div>
      </div>

      {/* Scrollable area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}>
        {/* Post summary */}
        <div style={{
          margin: '16px',
          padding: '12px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{post.title}</span>
              {post.status === 'closed' && <ClosedBadge size="small" />}
            </div>
            <button
              onClick={handleShare}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '12px',
                color: copied ? '#4a9d6b' : 'var(--accent)',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {copied ? '✓ Copied!' : <><ShareIcon size={12} /> Share</>}
            </button>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-primary)', marginTop: '4px' }}>
            <a href={getMapUrl()} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>{post.location}</a>
            <span style={{ margin: '0 8px', color: 'var(--text-secondary)' }}>·</span>
            <span>{post.time}</span>
          </div>
          {post.notes && (
            <div style={{ marginTop: '4px' }}>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-line',
                  ...(!threadNotesExpanded ? {
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical' as const,
                    overflow: 'hidden',
                    lineClamp: 3,
                  } : {}),
                  cursor: !threadNotesExpanded ? 'pointer' : undefined,
                }}
                onClick={!threadNotesExpanded ? () => setThreadNotesExpanded(true) : undefined}
              >
                {renderTextWithLinks(post.notes)}
              </div>
              {post.notes.length > 120 && (
                <button
                  onClick={() => setThreadNotesExpanded(!threadNotesExpanded)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '2px 0',
                    fontStyle: 'italic',
                  }}
                >
                  {threadNotesExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          )}
          {post.preference && post.preference !== 'anyone' && (
            <span style={{
              display: 'inline-block', fontSize: '12px', color: 'var(--text-secondary)',
              background: 'var(--bg-badge)', border: 'none',
              padding: '2px 8px', borderRadius: '12px', marginTop: '8px',
            }}>{post.preference}</span>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{post.name}</span>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, padding: '0 16px 16px 16px', display: 'flex', flexDirection: 'column' }}>
          {messages.length === 0 ? (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', minHeight: '100px',
            }}>
              Start the conversation when you&apos;re ready.
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => {
                const layout = messageLayout[idx];
                const daySeparator = layout.dayLabel && (
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 12px' }}>
                    <span style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      background: 'var(--pill-fill)',
                      padding: '3px 10px',
                      borderRadius: '12px',
                    }}>
                      {layout.dayLabel}
                    </span>
                  </div>
                );

                // System messages render as centered, muted text, with no time label
                if (msg.message_type === 'system') {
                  return (
                    <Fragment key={msg.id}>
                      {daySeparator}
                      <div style={{
                        textAlign: 'center',
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        padding: '8px 0',
                        fontStyle: 'italic',
                      }}>
                        {msg.content}
                      </div>
                    </Fragment>
                  );
                }

                const isFirstFromSender = layout.isFirstInCluster;
                const isLastFromSender = layout.isLastInCluster;
                const isSelf = msg.sender_id === currentUserId;
                const isGroupThread = thread?.thread_type === 'group';
                const hasReactions = (reactions[msg.id] || []).length > 0;

                // Under the last bubble of a cluster only. Sits outside the
                // avatar row so the avatar still lines up with the bubble.
                // With reaction pills it sits 12px (4px + an extra 8px) below
                // them; ReactableBubble already pads 4px under its pills.
                const timeLabel = isLastFromSender && (
                  <div style={{
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    marginTop: hasReactions ? '8px' : '4px',
                    textAlign: isSelf ? 'right' : 'left',
                    // Received bubbles start after the 28px avatar and 8px gap.
                    padding: isSelf ? '0 4px 0 0' : '0 0 0 40px',
                  }}>
                    {layout.clockTime}
                  </div>
                );

                if (isSelf) {
                  return (
                    <Fragment key={msg.id}>
                      {daySeparator}
                      <div style={{ marginBottom: isLastFromSender ? '12px' : '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <ReactableBubble
                            align="right"
                            text={msg.content}
                            canReact={false}
                            reactions={reactions[msg.id] || []}
                            currentUserId={currentUserId}
                            isGroup={isGroupThread}
                            nameFor={nameFor}
                            onReact={(emoji) => handleReact(msg, emoji)}
                          >
                            <div title={layout.fullTime} style={{
                              background: 'var(--accent)', color: 'var(--text-inverse)', padding: '10px 14px',
                              fontSize: '14px', maxWidth: '260px', borderRadius: '18px 18px 6px 18px',
                              wordWrap: 'break-word',
                              whiteSpace: 'pre-line',
                            }}>{renderTextWithLinks(msg.content, 'var(--text-inverse)')}</div>
                          </ReactableBubble>
                        </div>
                        {timeLabel}
                      </div>
                    </Fragment>
                  );
                }

                return (
                  <Fragment key={msg.id}>
                    {daySeparator}
                    <div style={{ marginBottom: isLastFromSender ? '12px' : '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '8px' }}>
                        {/* Avatar column, shown on the last message of a cluster */}
                        <div style={{
                          width: '28px',
                          flexShrink: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'flex-end'
                        }}>
                          {isLastFromSender && (
                            <MessageAvatar
                              senderId={msg.sender_id}
                              senderName={msg.sender_name || 'Unknown'}
                              avatarUrl={msg.sender_avatar_url}
                              dateOfBirth={msg.sender_date_of_birth}
                              showAvatar={true}
                            />
                          )}
                        </div>
                        <div>
                          {/* Sender name in group threads, on the first message of a cluster */}
                          {isGroupThread && isFirstFromSender && (
                            <div style={{
                              fontSize: '11px',
                              color: 'var(--text-secondary)',
                              marginBottom: '2px',
                              paddingLeft: '2px',
                            }}>
                              {msg.sender_name}
                            </div>
                          )}
                          <ReactableBubble
                            align="left"
                            text={msg.content}
                            canReact={true}
                            reactions={reactions[msg.id] || []}
                            currentUserId={currentUserId}
                            isGroup={isGroupThread}
                            nameFor={nameFor}
                            onReact={(emoji) => handleReact(msg, emoji)}
                          >
                            <div title={layout.fullTime} style={{
                              background: 'var(--bg-card)', color: 'var(--text-primary)', padding: '10px 14px',
                              fontSize: '14px', maxWidth: '260px', borderRadius: '18px 18px 18px 6px',
                              border: '1px solid var(--border)',
                              wordWrap: 'break-word',
                              whiteSpace: 'pre-line',
                            }}>{renderTextWithLinks(msg.content)}</div>
                          </ReactableBubble>
                        </div>
                      </div>
                      {timeLabel}
                    </div>
                  </Fragment>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      {/* Input area */}
      <div style={{
        padding: '16px',
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        borderTop: '1px solid var(--border)',
        flexShrink: 0,
        background: 'var(--bg-badge)',
      }}>
        <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
  <textarea
    placeholder={thread?.thread_type === 'group' ? 'Type something...' : 'Type something...'}
    value={newMessage}
    onChange={(e) => {
      setNewMessage(e.target.value);
      // Auto-resize
      e.target.style.height = 'auto';
      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    }}
    onKeyDown={(e) => {
      const isMobile = window.innerWidth < 768;
      if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
        e.preventDefault();
        handleSendMessage(e);
      }
    }}
    rows={1}
    style={{
      flex: 1,
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '10px 16px',
      fontSize: '14px',
      outline: 'none',
      resize: 'none',
      lineHeight: '1.4',
      maxHeight: '120px',
      overflow: 'auto',
      fontFamily: 'inherit',
    }}
  />
  <button
    type="submit"
    disabled={!newMessage.trim() || sending}
    aria-label="Send message"
    style={{
      background: newMessage.trim() && !sending ? 'var(--accent)' : 'var(--border)',
      border: 'none',
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      cursor: newMessage.trim() && !sending ? 'pointer' : 'not-allowed',
      transition: 'background 0.15s ease',
    }}
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-inverse)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  </button>
</form>
      </div>
    </div>
  );
}