'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import BottomNav from '../../components/BottomNav';

interface Post {
  id: string;
  title: string;
  location: string;
  time: string;
  notes: string | null;
  name: string;
  preference: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'hidden';
  created_at: string;
  user_id: string;
  user_email?: string;
}

export default function AdminPostsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [actioningPost, setActioningPost] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [pendingPostsCount, setPendingPostsCount] = useState(0);
  const [pendingReportsCount, setPendingReportsCount] = useState(0);
  const [confirmReject, setConfirmReject] = useState<{
    postId: string;
    postTitle: string;
    userId: string;
  } | null>(null);

  // Check screen size
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Check auth and admin status
  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push('/');
        return;
      }
      setUser(session.user);

      // Check if user is admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single();

      if (!profile?.is_admin) {
        router.push('/');
        return;
      }
      setIsAdmin(true);
    }

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        router.push('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  // Fetch posts and counts
  useEffect(() => {
    async function fetchPosts() {
      if (!isAdmin) return;

      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('status', filter)
        .order('created_at', { ascending: filter === 'pending' });

      if (error) {
        console.error('Error fetching posts:', error);
        setLoading(false);
        return;
      }

      setPosts(data || []);
      setLoading(false);
    }

    async function fetchCounts() {
      const [postsRes, reportsRes] = await Promise.all([
        supabase.from('posts').select('id', { count: 'exact' }).eq('status', 'pending'),
        supabase.from('reports').select('id', { count: 'exact' }).eq('status', 'pending'),
      ]);
      setPendingPostsCount(postsRes.count || 0);
      setPendingReportsCount(reportsRes.count || 0);
    }

    if (isAdmin) {
      setLoading(true);
      fetchPosts();
      fetchCounts();
    }
  }, [isAdmin, filter]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleApprove = async (postId: string, userId: string, postTitle: string) => {
    setActioningPost(postId);

    const { error } = await supabase
      .from('posts')
      .update({ status: 'approved' })
      .eq('id', postId);

    if (error) {
      console.error('Error approving post:', error);
      alert('Failed to approve post');
      setActioningPost(null);
      return;
    }

    // Send approval email
    try {
      const response = await supabase.functions.invoke('post-moderation-notification', {
        body: {
          postId,
          userId,
          postTitle,
          action: 'approved',
        },
      });
      console.log('Email function response:', response);
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError);
    }

    // Update local state
    setPosts(prev => prev.filter(p => p.id !== postId));
    setPendingPostsCount(prev => Math.max(0, prev - 1));
    setActioningPost(null);
  };

  const handleReject = async (postId: string, userId: string, postTitle: string) => {
    setActioningPost(postId);

    const { error } = await supabase
      .from('posts')
      .update({ status: 'rejected' })
      .eq('id', postId);

    if (error) {
      console.error('Error rejecting post:', error);
      alert('Failed to reject post');
      setActioningPost(null);
      return;
    }

    // Send rejection email
    try {
      const response = await supabase.functions.invoke('post-moderation-notification', {
        body: {
          postId,
          userId,
          postTitle,
          action: 'rejected',
        },
      });
      console.log('Email function response:', response);
    } catch (emailError) {
      console.error('Failed to send rejection email:', emailError);
    }

    // Update local state
    setPosts(prev => prev.filter(p => p.id !== postId));
    setPendingPostsCount(prev => Math.max(0, prev - 1));
    setActioningPost(null);
    setConfirmReject(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString('en-GB', { 
        day: 'numeric',
        month: 'short',
      });
    }
  };

  const handleMobileTabChange = (tab: 'home' | 'messages' | 'activity' | 'menu') => {
    if (tab === 'home') {
      router.push('/');
    } else if (tab === 'messages') {
      router.push('/?messages=open');
    } else if (tab === 'activity') {
      router.push('/my-activity');
    }
  };

  const pendingCount = posts.length;

  if (!user || !isAdmin || loading) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        fontFamily: "'Satoshi', 'Inter', system-ui, sans-serif",
        color: '#888',
        fontSize: '14px',
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: "'Satoshi', 'Inter', system-ui, sans-serif",
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
        {/* Sidebar - Desktop only */}
        {!isMobile && (
          <div style={{
            width: '224px',
            flexShrink: 0,
            borderRight: '1px solid #F0F0F0',
            background: 'rgba(250, 250, 250, 0.5)',
            overflow: 'hidden',
          }}>
            <Sidebar
              userId={user.id}
              selectedThreadId={null}
              onSelectThread={(threadId) => router.push(`/?thread=${threadId}`)}
              onNavigateToMyActivity={() => router.push('/my-activity')}
              onLogout={handleLogout}
              activeItem="admin-posts"
            />
          </div>
        )}

        {/* Main content */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto',
          background: '#FAFAFA',
          paddingBottom: isMobile ? '80px' : '0',
        }}>
          <div style={{ 
            maxWidth: '720px', 
            width: '100%', 
            margin: '0 auto', 
            padding: isMobile ? '16px' : '32px 24px',
          }}>
            {/* Page header */}
            <div style={{ marginBottom: isMobile ? '20px' : '32px' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                marginBottom: '8px',
                flexWrap: 'wrap',
              }}>
                <h1 style={{ 
                  fontSize: isMobile ? '20px' : '24px', 
                  fontWeight: 700, 
                  color: '#000',
                  letterSpacing: '-0.5px',
                  margin: 0,
                }}>
                  Post approval
                </h1>
                {filter === 'pending' && pendingCount > 0 && (
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#D4594F',
                    background: '#FBEEED',
                    padding: '4px 12px',
                    borderRadius: '16px',
                  }}>
                    {pendingCount} pending
                  </span>
                )}
              </div>
              <p style={{ 
                fontSize: '14px', 
                color: '#888', 
                margin: 0,
              }}>
                Review and approve new posts before they go live
              </p>
            </div>

            {/* Filter tabs */}
            <div style={{ 
              display: 'flex', 
              gap: '8px',
              marginBottom: '24px',
              borderBottom: '1px solid #E0E0E0',
              paddingBottom: '16px',
              overflowX: 'auto',
            }}>
              {[
                { key: 'pending', label: 'Pending' },
                { key: 'approved', label: 'Approved' },
                { key: 'rejected', label: 'Rejected' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key as typeof filter)}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '24px',
                    background: filter === tab.key ? '#000' : 'transparent',
                    color: filter === tab.key ? '#fff' : '#666',
                    fontSize: '14px',
                    fontWeight: filter === tab.key ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Posts list */}
            {posts.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '64px 24px',
                color: '#888',
              }}>
                <div style={{ 
                  fontSize: '40px', 
                  marginBottom: '16px',
                  opacity: 0.5,
                }}>
                  {filter === 'pending' ? '✓' : '📭'}
                </div>
                <p style={{ fontSize: '16px', fontWeight: 500, color: '#444', marginBottom: '4px' }}>
                  {filter === 'pending' ? 'All caught up' : `No ${filter} posts`}
                </p>
                <p style={{ fontSize: '14px', color: '#888' }}>
                  {filter === 'pending' 
                    ? 'No posts waiting for approval' 
                    : 'Nothing to show here'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {posts.map(post => {
                  const isActioning = actioningPost === post.id;
                  return (
                    <div
                      key={post.id}
                      style={{
                        background: '#fff',
                        border: '1px solid #E0E0E0',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      }}
                    >
                      {/* Post content */}
                      <div style={{ padding: isMobile ? '16px' : '20px' }}>
                        {/* Header with time */}
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'flex-start',
                          marginBottom: '12px',
                          gap: '12px',
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h3 style={{ 
                              fontSize: '16px', 
                              fontWeight: 600, 
                              color: '#000',
                              margin: '0 0 4px 0',
                            }}>
                              {post.title}
                            </h3>
                            <div style={{ fontSize: '14px', color: '#666' }}>
                              {post.location}
                            </div>
                            <div style={{ fontSize: '14px', color: '#666' }}>
                              {post.time}
                            </div>
                          </div>
                          <span style={{ 
                            fontSize: '13px', 
                            color: '#888',
                            flexShrink: 0,
                          }}>
                            {formatDate(post.created_at)}
                          </span>
                        </div>

                        {/* Notes */}
                        {post.notes && (
                          <p style={{ 
                            fontSize: '15px', 
                            fontStyle: 'italic',
                            color: '#666', 
                            margin: '12px 0',
                            lineHeight: 1.5,
                          }}>
                            "{post.notes}"
                          </p>
                        )}

                        {/* Preference badge */}
                        {post.preference && post.preference !== 'Anyone' && post.preference !== 'anyone' && (
                          <span style={{
                            display: 'inline-block',
                            fontSize: '12px',
                            color: '#888',
                            background: '#fafafa',
                            border: '1px solid #e0e0e0',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            marginBottom: '12px',
                          }}>
                            {post.preference}
                          </span>
                        )}

                        {/* Posted by */}
                        <div style={{ 
                          fontSize: '13px', 
                          color: '#888',
                          paddingTop: '12px',
                          borderTop: '1px solid #F0F0F0',
                        }}>
                          Posted by {post.name}
                        </div>
                      </div>

                      {/* Actions - only for pending posts */}
                      {filter === 'pending' && (
                        <div style={{ 
                          padding: isMobile ? '12px 16px' : '16px 20px',
                          borderTop: '1px solid #F0F0F0',
                          background: '#FAFAFA',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                        }}>
                          <button
                            onClick={() => handleApprove(post.id, post.user_id, post.title)}
                            disabled={isActioning}
                            style={{
                              padding: isMobile ? '10px 20px' : '10px 24px',
                              border: 'none',
                              borderRadius: '24px',
                              background: '#000',
                              color: '#fff',
                              fontSize: '14px',
                              fontWeight: 600,
                              cursor: isActioning ? 'not-allowed' : 'pointer',
                              opacity: isActioning ? 0.5 : 1,
                              transition: 'all 0.15s ease',
                            }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setConfirmReject({
                              postId: post.id,
                              postTitle: post.title,
                              userId: post.user_id,
                            })}
                            disabled={isActioning}
                            style={{
                              padding: isMobile ? '10px 20px' : '10px 24px',
                              border: '1px solid #E0E0E0',
                              borderRadius: '24px',
                              background: '#fff',
                              color: '#666',
                              fontSize: '14px',
                              fontWeight: 500,
                              cursor: isActioning ? 'not-allowed' : 'pointer',
                              opacity: isActioning ? 0.5 : 1,
                              transition: 'all 0.15s ease',
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Nav - Mobile only */}
      {isMobile && (
        <BottomNav
          activeTab="menu"
          onTabChange={handleMobileTabChange}
          onLogout={handleLogout}
          isAdmin={true}
          pendingPostsCount={pendingPostsCount}
          pendingReportsCount={pendingReportsCount}
        />
      )}

      {/* Rejection Confirmation Modal */}
      {confirmReject && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={() => setConfirmReject(null)}
        >
          <div 
            style={{
              background: '#fff',
              borderRadius: '16px',
              padding: isMobile ? '24px' : '32px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ 
              fontSize: '18px', 
              fontWeight: 600, 
              color: '#000',
              marginBottom: '12px',
            }}>
              Reject this post?
            </h2>
            <p style={{ 
              fontSize: '14px', 
              color: '#666', 
              lineHeight: 1.6,
              marginBottom: '8px',
            }}>
              "{confirmReject.postTitle}" will not be published.
            </p>
            <p style={{ 
              fontSize: '13px', 
              color: '#888', 
              lineHeight: 1.5,
              marginBottom: '24px',
            }}>
              The user will be notified by email with a link to our community guidelines.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmReject(null)}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #E0E0E0',
                  borderRadius: '24px',
                  background: '#fff',
                  color: '#666',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(confirmReject.postId, confirmReject.userId, confirmReject.postTitle)}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '24px',
                  background: '#D4594F',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Reject post
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}