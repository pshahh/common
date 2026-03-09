'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateAge, getInitials } from '@/lib/profile';
import ClosedBadge from './ClosedBadge';
import { renderTextWithLinks } from '@/lib/textUtils';

interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  created_at: string;
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
}

interface Thread {
  id: string;
  post_id: string;
  participant_ids: string[];
  closed_at: string | null;
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
}

export default function MessageThread({
  threadId,
  currentUserId,
  onClose,
  onReport,
  onLeaveThread,
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
  
  // Modal states for Leave/Block
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Check if thread is closed
  const isThreadClosed = (): boolean => {
    if (!thread) return false;
    if (thread.closed_at) return true;
    if (thread.post?.expires_at) {
      const expiresAt = new Date(thread.post.expires_at);
      const closeTime = new Date(expiresAt.getTime() + 24 * 60 * 60 * 1000);
      if (new Date() > closeTime) return true;
    }
    return false;
  };

  // Get the other participant(s) for blocking
  const getOtherParticipantId = (): string | null => {
    if (!thread) return null;
    const others = thread.participant_ids.filter(id => id !== currentUserId);
    return others[0] || null;
  };

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

      const { data: threadData, error: threadError } = await supabase
        .from('threads')
        .select(`
          id,
          post_id,
          participant_ids,
          closed_at,
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
            status
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

      const postData = threadData.posts;
      const post: Post | null = Array.isArray(postData) ? postData[0] || null : postData;

      setThread({
        id: threadData.id,
        post_id: threadData.post_id,
        participant_ids: threadData.participant_ids,
        closed_at: threadData.closed_at,
        post: post,
      });

      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('id, thread_id, sender_id, content, created_at')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (!isMounted) return;

      if (messagesError) {
        console.error('Error fetching messages:', messagesError.message);
        setLoading(false);
        return;
      }

      if (messagesData && messagesData.length > 0) {
        const senderIds = [...new Set(messagesData.map(m => m.sender_id))];
        const profilePromises = senderIds.map(async (senderId) => {
          const profile = await getProfileData(senderId);
          return { senderId, profile };
        });

        const profiles = await Promise.all(profilePromises);
        const profileMap: Record<string, ProfileData> = {};
        profiles.forEach(p => { profileMap[p.senderId] = p.profile; });

        const transformedMessages: Message[] = messagesData.map((msg) => ({
          id: msg.id,
          thread_id: msg.thread_id,
          sender_id: msg.sender_id,
          content: msg.content,
          created_at: msg.created_at,
          sender_name: profileMap[msg.sender_id]?.first_name || 'Unknown',
          sender_avatar_url: profileMap[msg.sender_id]?.avatar_url,
          sender_date_of_birth: profileMap[msg.sender_id]?.date_of_birth,
        }));

        setMessages(transformedMessages);
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending || isThreadClosed()) return;

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
      // Mark as read after sending own message
      markThreadAsRead();
    }

    setSending(false);
  };

  const getMapUrl = () => {
    if (!thread?.post) return '#';
    const { latitude, longitude, location } = thread.post;
    if (latitude && longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  };

  const handleShare = () => {
    if (!thread?.post) return;
    const url = `${window.location.origin}/post/${thread.post.id}`;
    navigator.clipboard.writeText(url);
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

  const handleBlockUser = async () => {
    const otherUserId = getOtherParticipantId();
    if (!otherUserId) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc('block_user', {
        blocked_user_id: otherUserId
      });
      if (error) {
        console.error('Error blocking user:', JSON.stringify(error, null, 2));
        alert('Failed to block user. Please try again.');
        setActionLoading(false);
        return;
      }
      setShowBlockModal(false);
      setActionLoading(false);
      if (onLeaveThread) {
        onLeaveThread();
      } else {
        onClose();
      }
    } catch (err) {
      console.error('Error blocking user:', err);
      alert('Failed to block user. Please try again.');
      setActionLoading(false);
    }
  };

  // Check if both participants have sent messages (for avatar reveal)
  const bothHaveSentMessages = (): boolean => {
    if (!thread) return false;
    const senderIds = new Set(messages.map(m => m.sender_id));
    return thread.participant_ids.every(id => senderIds.has(id));
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

    const canReveal = bothHaveSentMessages();
    const age = dateOfBirth ? calculateAge(dateOfBirth) : null;

    if (canReveal && avatarUrl) {
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
              background: '#333',
              color: '#fff',
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
        background: '#f0f0f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: '11px',
        color: '#888',
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
          <div style={{ color: '#fff', marginTop: '12px', fontSize: '14px', fontWeight: 500 }}>
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
          background: '#fff', borderRadius: '16px', padding: '24px',
          maxWidth: '340px', width: '100%', margin: '0 16px',
        }}>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#000', marginBottom: '12px' }}>
            Leave this conversation?
          </div>
          <div style={{ fontSize: '14px', color: '#444', marginBottom: '20px', lineHeight: 1.5 }}>
            You&apos;ll no longer receive messages from this thread. Others will see that you&apos;ve left.
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowLeaveModal(false)}
              disabled={actionLoading}
              style={{
                padding: '10px 20px', borderRadius: '20px', fontSize: '14px',
                fontWeight: 500, border: '1px solid #e0e0e0', background: '#fff',
                cursor: actionLoading ? 'not-allowed' : 'pointer', color: '#444',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleLeaveThread}
              disabled={actionLoading}
              style={{
                padding: '10px 20px', borderRadius: '20px', fontSize: '14px',
                fontWeight: 500, border: 'none', background: '#000',
                cursor: actionLoading ? 'not-allowed' : 'pointer',
                color: '#fff', opacity: actionLoading ? 0.6 : 1,
              }}
            >
              {actionLoading ? 'Leaving...' : 'Leave'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const BlockUserModal = () => {
    if (!showBlockModal) return null;
    return (
      <div 
        onClick={() => !actionLoading && setShowBlockModal(false)}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}
      >
        <div onClick={(e) => e.stopPropagation()} style={{
          background: '#fff', borderRadius: '16px', padding: '24px',
          maxWidth: '340px', width: '100%', margin: '0 16px',
        }}>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#000', marginBottom: '12px' }}>
            Block this person?
          </div>
          <div style={{ fontSize: '14px', color: '#444', marginBottom: '20px', lineHeight: 1.5 }}>
            You won&apos;t see their posts and will be removed from any shared conversations. They won&apos;t be notified that you&apos;ve blocked them.
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowBlockModal(false)}
              disabled={actionLoading}
              style={{
                padding: '10px 20px', borderRadius: '20px', fontSize: '14px',
                fontWeight: 500, border: '1px solid #e0e0e0', background: '#fff',
                cursor: actionLoading ? 'not-allowed' : 'pointer', color: '#444',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleBlockUser}
              disabled={actionLoading}
              style={{
                padding: '10px 20px', borderRadius: '20px', fontSize: '14px',
                fontWeight: 500, border: 'none', background: '#000',
                cursor: actionLoading ? 'not-allowed' : 'pointer',
                color: '#fff', opacity: actionLoading ? 0.6 : 1,
              }}
            >
              {actionLoading ? 'Blocking...' : 'Block'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '16px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '16px', fontWeight: 600 }}>Loading...</span>
          <button onClick={onClose} style={{
            background: '#fff', border: '1px solid #e0e0e0', fontSize: '18px',
            color: '#444', cursor: 'pointer', width: '36px', height: '36px',
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>
      </div>
    );
  }

  if (!thread || !thread.post) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '16px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '16px', fontWeight: 600 }}>Thread not found</span>
          <button onClick={onClose} style={{
            background: '#fff', border: '1px solid #e0e0e0', fontSize: '18px',
            color: '#444', cursor: 'pointer', width: '36px', height: '36px',
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>
      </div>
    );
  }

  const post = thread.post;
  const threadClosed = isThreadClosed();

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <ExpandedPhotoModal />
      <LeaveConversationModal />
      <BlockUserModal />
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px', fontWeight: 600, color: '#000' }}>{post.title}</span>
          {post.status === 'closed' && <ClosedBadge size="small" />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              style={{
                background: 'none', border: 'none', fontSize: '18px', color: '#888',
                cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >⋯</button>
            {showMenu && (
              <div style={{
                position: 'absolute', right: 0, top: '36px', background: '#fff',
                border: '1px solid #e0e0e0', borderRadius: '12px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: '176px',
                zIndex: 20, overflow: 'hidden',
              }}>
                <div 
                  onClick={() => { setShowMenu(false); if (post) onReport?.(post.id, threadId); }} 
                  style={{ padding: '12px 16px', fontSize: '14px', color: '#444', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
                >
                  Report post
                </div>
                <div 
                  onClick={() => { setShowMenu(false); setShowLeaveModal(true); }} 
                  style={{ padding: '12px 16px', fontSize: '14px', color: '#444', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
                >
                  Leave conversation
                </div>
                <div 
                  onClick={() => { setShowMenu(false); setShowBlockModal(true); }} 
                  style={{ padding: '12px 16px', fontSize: '14px', color: '#dc2626', cursor: 'pointer' }}
                >
                  Block this person
                </div>
              </div>
            )}
          </div>
          <button onClick={onClose} style={{
            background: '#fff', border: '1px solid #e0e0e0', fontSize: '18px',
            color: '#444', cursor: 'pointer', width: '36px', height: '36px',
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}>×</button>
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
          background: 'rgba(250,250,250,0.8)',
          border: '1px solid #e0e0e0',
          borderRadius: '12px',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '14px', fontWeight: 500, color: '#000' }}>{post.title}</span>
              {post.status === 'closed' && <ClosedBadge size="small" />}
            </div>
            <button 
              onClick={handleShare} 
              style={{ 
                background: 'none', 
                border: 'none', 
                fontSize: '12px', 
                color: copied ? '#4a9d6b' : '#888', 
                cursor: 'pointer', 
                padding: 0 
              }}
            >
              {copied ? '✓ Copied!' : 'Share ↗'}
            </button>
          </div>
          <div style={{ fontSize: '12px', color: '#444', marginTop: '4px' }}>
            <a href={getMapUrl()} target="_blank" rel="noopener noreferrer" style={{ color: '#444', textDecoration: 'underline' }}>{post.location}</a>
            <span style={{ margin: '0 8px', color: '#888' }}>·</span>
            <span>{post.time}</span>
          </div>
          {post.notes && <div style={{ fontSize: '12px', color: '#444', marginTop: '4px', whiteSpace: 'pre-line' }}>{renderTextWithLinks(post.notes)}</div>}
          {post.preference && post.preference !== 'anyone' && (
            <span style={{
              display: 'inline-block', fontSize: '12px', color: '#888',
              background: '#fafafa', border: '1px solid #e0e0e0',
              padding: '2px 8px', borderRadius: '12px', marginTop: '8px',
            }}>{post.preference}</span>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <span style={{ fontSize: '12px', color: '#888' }}>{post.name}</span>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, padding: '0 16px 16px 16px', display: 'flex', flexDirection: 'column' }}>
          {messages.length === 0 ? (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', color: '#888', textAlign: 'center', minHeight: '100px',
            }}>
              {threadClosed ? 'This conversation has ended.' : 'Start the conversation when you\'re ready.'}
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => {
                const prevMsg = messages[idx - 1];
                const nextMsg = messages[idx + 1];
                const isFirstFromSender = !prevMsg || prevMsg.sender_id !== msg.sender_id;
                const isLastFromSender = !nextMsg || nextMsg.sender_id !== msg.sender_id;
                const isSelf = msg.sender_id === currentUserId;

                if (isSelf) {
                  return (
                    <div key={msg.id} style={{
                      display: 'flex', justifyContent: 'flex-end',
                      marginBottom: isLastFromSender ? '12px' : '4px',
                    }}>
                      <div style={{
                        background: '#000', color: '#fff', padding: '10px 14px',
                        fontSize: '14px', maxWidth: '260px', borderRadius: '18px 18px 6px 18px',
                        wordWrap: 'break-word',
                      }}>{msg.content}</div>
                    </div>
                  );
                } else {
                  return (
                    <div key={msg.id} style={{
                      display: 'flex', justifyContent: 'flex-start', gap: '8px',
                      marginBottom: isLastFromSender ? '12px' : '4px',
                    }}>
                      {/* Avatar column — shown on last message in a group */}
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
                      <div style={{
                        background: '#fafafa', color: '#000', padding: '10px 14px',
                        fontSize: '14px', maxWidth: '260px', borderRadius: '18px 18px 18px 6px',
                        wordWrap: 'break-word',
                      }}>{msg.content}</div>
                    </div>
                  );
                }
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      {/* Input area */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid #f0f0f0',
        flexShrink: 0,
        background: threadClosed ? '#fafafa' : '#fff',
      }}>
        {threadClosed ? (
          <div style={{ 
            fontSize: '13px', 
            color: '#888', 
            textAlign: 'center',
            padding: '8px 0',
          }}>
            This conversation closed 24 hours after the activity ended.
          </div>
        ) : (
          <>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px', lineHeight: 1.4 }}>
              Conversations close 24 hours after the activity ends. You can still read past messages.
            </div>
            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
  <textarea
    placeholder="Type your message..."
    value={newMessage}
    onChange={(e) => {
      setNewMessage(e.target.value);
      // Auto-resize
      e.target.style.height = 'auto';
      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    }}
    onKeyDown={(e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage(e);
      }
    }}
    rows={1}
    style={{
      flex: 1, 
      border: '1px solid #e0e0e0', 
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
    style={{
      background: 'none', border: 'none', fontSize: '18px',
      color: newMessage.trim() && !sending ? '#000' : '#888',
      cursor: newMessage.trim() && !sending ? 'pointer' : 'not-allowed',
      padding: '0 8px',
      marginBottom: '4px',
    }}
  >→</button>
</form>
          </>
        )}
      </div>
    </div>
  );
}