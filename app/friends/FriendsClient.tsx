'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useUnreadCount } from '@/lib/useUnreadCount';
import { useShareInvite } from '@/lib/useShareInvite';
import { User } from '@supabase/supabase-js';
import { getAvatarUrl, getInitials } from '@/lib/profile';
import Header from '@/app/components/Header';
import Sidebar from '@/app/components/Sidebar';
import BottomNav from '@/app/components/BottomNav';
import ShareInviteModal from '@/app/components/ShareInviteModal';

interface Friend {
  id: string;
  friendshipId: string;
  first_name: string;
  avatar_url: string | null;
  created_at: string;
}

export default function FriendsClient() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingReportsCount, setPendingReportsCount] = useState(0);
  const [mobileTab, setMobileTab] = useState<'home' | 'messages' | 'activity' | 'menu'>('menu');
  const [connectSlug, setConnectSlug] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState<{ first_name: string; avatar_url: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  const { unreadCount: threadCount } = useUnreadCount(user?.id);
  const { shareUrl, showModal: showShareModal, handleShareClick: handleShareInvite, closeModal: closeShareModal } = useShareInvite({ userId: user?.id });

  // Check screen size
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch current user's profile and connect slug
  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('first_name, avatar_url, connect_slug, is_admin')
        .eq('id', user.id)
        .single();
      if (data) {
        setConnectSlug(data.connect_slug);
        setCurrentProfile({ first_name: data.first_name, avatar_url: data.avatar_url });
        setIsAdmin(data.is_admin || false);
      }
    }
    fetchProfile();
  }, [user]);

  // Fetch admin reports count
  useEffect(() => {
    async function fetchReports() {
      if (!isAdmin) return;
      const { count } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      setPendingReportsCount(count || 0);
    }
    fetchReports();
  }, [isAdmin]);

  async function copyToClipboard(text: string): Promise<boolean> {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for mobile / non-HTTPS
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      document.body.removeChild(textarea);
      return false;
    }
  }

  // Fetch friends list
  useEffect(() => {
    async function fetchFriends() {
      if (!user) return;

      const { data: friendships, error } = await supabase
        .from('friendships')
        .select('id, user_id_1, user_id_2, created_at')
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);

      if (error || !friendships) {
        setLoading(false);
        return;
      }

      if (friendships.length === 0) {
        setFriends([]);
        setLoading(false);
        return;
      }

      // Get friend user IDs
      const friendUserIds = friendships.map(f =>
        f.user_id_1 === user.id ? f.user_id_2 : f.user_id_1
      );

      // Fetch their profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, avatar_url')
        .in('id', friendUserIds);

      if (profiles) {
        const friendsList: Friend[] = profiles.map(profile => {
          const friendship = friendships.find(f =>
            f.user_id_1 === profile.id || f.user_id_2 === profile.id
          );
          return {
            id: profile.id,
            friendshipId: friendship!.id,
            first_name: profile.first_name,
            avatar_url: profile.avatar_url,
            created_at: friendship!.created_at,
          };
        });

        // Sort alphabetically by name
        friendsList.sort((a, b) => a.first_name.localeCompare(b.first_name));
        setFriends(friendsList);
      }

      setLoading(false);
    }
    fetchFriends();
  }, [user]);

  // Remove friend
  const handleRemoveFriend = async (friendshipId: string) => {
    setRemovingId(friendshipId);

    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);

    if (!error) {
      setFriends(prev => prev.filter(f => f.friendshipId !== friendshipId));
    }

    setRemovingId(null);
    setShowRemoveConfirm(null);
  };

  const handleCopyLink = async () => {
    if (!connectSlug) return;
    const url = `${window.location.origin}/connect/${connectSlug}`;
    await copyToClipboard(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const handleMobileTabChange = (tab: 'home' | 'messages' | 'activity' | 'menu') => {
    setMobileTab(tab);
    if (tab === 'home') {
      router.push('/');
    } else if (tab === 'messages') {
      router.push('/?messages=open');
    } else if (tab === 'activity') {
      router.push('/my-activity');
    }
  };

  if (!user || loading) {
    return null;
  }

  const friendshipUrl = connectSlug ? `${window.location.origin}/connect/${connectSlug}` : '';

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <Header
        onLoginClick={() => {}}
        user={user}
        onLogout={handleLogout}
      />

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden',
      }}>
        {/* Sidebar - Hidden on mobile */}
        {!isMobile && (
          <div style={{
            width: '224px',
            flexShrink: 0,
            borderRight: '1px solid var(--border-light)',
            background: 'rgba(250, 250, 250, 0.5)',
            overflow: 'hidden',
          }}>
            <Sidebar
              userId={user.id}
              selectedThreadId={null}
              onSelectThread={(threadId) => router.push(`/?thread=${threadId}`)}
              onNavigateToMyActivity={() => router.push('/my-activity')}
              onLogout={handleLogout}
              activeItem="friends"
            />
          </div>
        )}

        {/* Main content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          paddingBottom: isMobile ? '80px' : '0',
        }}>
          <div style={{
            maxWidth: '500px',
            width: '100%',
            margin: '0 auto',
            padding: isMobile ? '24px 16px' : '40px 24px',
          }}>
            <h1 style={{
              fontSize: '22px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '8px',
              letterSpacing: '-0.3px',
            }}>
              Friends
            </h1>
            <p style={{
  fontSize: '14px',
  color: 'var(--text-secondary)',
  marginBottom: '28px',
}}>
  Share your friendship link to connect with friends on common.
</p>

            {/* Friendship link section */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '28px',
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                marginBottom: '12px',
              }}>
                Your friendship link
              </div>

              {/* Link display */}
              <div style={{
                background: 'var(--bg-badge)',
                border: '1px solid var(--border-light)',
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '13px',
                color: 'var(--text-secondary)',
                marginBottom: '14px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {friendshipUrl}
              </div>

              {/* Copy button */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleCopyLink}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '20px',
                    border: 'none',
                    background: 'var(--accent)',
                    color: 'var(--text-inverse)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {copied ? '✓ Copied!' : 'Copy link'}
                </button>
              </div>
            </div>

            {/* Friends list or empty state */}
            {friends.length === 0 ? (
              <div style={{
                textAlign: 'center',
                paddingTop: '40px',
                paddingBottom: '40px',
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
                <p style={{
                  fontSize: '16px',
                  color: 'var(--text-primary)',
                  lineHeight: 1.55,
                  maxWidth: '260px',
                  margin: '0 auto',
                }}>
                  Share your friendship link with friends to start seeing what they're up to.
                </p>
              </div>
            ) : (
              <div>
                {friends.map(friend => {
                  const avatarUrl = friend.avatar_url
                    ? getAvatarUrl(friend.avatar_url, process.env.NEXT_PUBLIC_SUPABASE_URL!)
                    : null;

                  return (
                    <div
                      key={friend.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 0',
                        borderBottom: '1px solid var(--border-light)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Avatar */}
                        <div style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '50%',
                          background: 'var(--bg-badge)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          flexShrink: 0,
                        }}>
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={friend.first_name}
                              width={200}
                              height={200}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <span style={{
                              fontSize: '16px',
                              fontWeight: 600,
                              color: 'var(--text-secondary)',
                            }}>
                              {getInitials(friend.first_name)}
                            </span>
                          )}
                        </div>

                        {/* Name */}
                        <div>
                          <div style={{
                            fontSize: '15px',
                            fontWeight: 500,
                            color: 'var(--text-primary)',
                          }}>
                            {friend.first_name}
                          </div>
                        </div>
                      </div>

                      {/* Remove button / confirm */}
                      {showRemoveConfirm === friend.friendshipId ? (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{
                            fontSize: '12px',
                            color: 'var(--text-secondary)',
                          }}>
                            Remove?
                          </span>
                          <button
                            onClick={() => handleRemoveFriend(friend.friendshipId)}
                            disabled={removingId === friend.friendshipId}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '16px',
                              border: 'none',
                              background: '#dc2626',
                              color: '#FFFFFF',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              opacity: removingId === friend.friendshipId ? 0.7 : 1,
                            }}
                          >
                            {removingId === friend.friendshipId ? '...' : 'Yes'}
                          </button>
                          <button
                            onClick={() => setShowRemoveConfirm(null)}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '16px',
                              border: '1px solid var(--border)',
                              background: 'var(--bg-card)',
                              color: 'var(--text-primary)',
                              fontSize: '12px',
                              fontWeight: 500,
                              cursor: 'pointer',
                            }}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowRemoveConfirm(friend.friendshipId)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '16px',
                            border: '1px solid var(--border)',
                            background: 'var(--bg-card)',
                            color: 'var(--text-secondary)',
                            fontSize: '12px',
                            fontWeight: 500,
                            cursor: 'pointer',
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      {isMobile && (
        <BottomNav
          activeTab={mobileTab}
          onTabChange={handleMobileTabChange}
          messageCount={threadCount}
          onLogout={handleLogout}
          isAdmin={isAdmin}
          pendingReportsCount={pendingReportsCount}
        />
      )}

      {/* Share preview modal */}
      <ShareInviteModal
        isOpen={showShareModal}
        onClose={closeShareModal}
        userName={currentProfile?.first_name || ''}
        avatarUrl={currentProfile?.avatar_url ? getAvatarUrl(currentProfile.avatar_url, process.env.NEXT_PUBLIC_SUPABASE_URL!) : null}
        shareUrl={shareUrl || ''}
      />
    </div>
  );
}