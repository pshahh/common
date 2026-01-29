'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import AuthModal from '../components/AuthModal';
import EditPostModal from '../components/EditPostModal';
import CreatePostModal from '../components/CreatePostModal';

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
  people_interested: number;
  user_id: string;
  created_at: string;
  expires_at: string | null;
  status: string;
}

export default function MyActivityPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [overflowMenuId, setOverflowMenuId] = useState<string | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Check auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        router.push('/');
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        router.push('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  // Fetch user's posts
  useEffect(() => {
    async function fetchMyPosts() {
      if (!user) return;

      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['approved', 'pending'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching posts:', error);
      } else {
        setPosts(data || []);
      }
      setLoading(false);
    }

    if (user) {
      fetchMyPosts();
    }
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);

  const handleShare = async (post: Post) => {
    const url = `${window.location.origin}/post/${post.id}`;
    await navigator.clipboard.writeText(url);
    setCopiedPostId(post.id);
    setTimeout(() => setCopiedPostId(null), 2000);
  };

  const handleClosePost = async () => {
    if (!selectedPostId) return;
    setActionLoading(true);

    const { error } = await supabase
      .from('posts')
      .update({ status: 'closed' })
      .eq('id', selectedPostId);

    if (error) {
      console.error('Error closing post:', error);
      alert('Failed to close post. Please try again.');
    } else {
      setPosts(posts.filter(p => p.id !== selectedPostId));
    }

    setActionLoading(false);
    setShowCloseModal(false);
    setSelectedPostId(null);
  };

  const handleDeletePost = async () => {
    if (!selectedPostId) return;
    setActionLoading(true);

    const { error } = await supabase
      .from('posts')
      .update({ status: 'deleted' })
      .eq('id', selectedPostId);

    if (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post. Please try again.');
    } else {
      setPosts(posts.filter(p => p.id !== selectedPostId));
    }

    setActionLoading(false);
    setShowDeleteModal(false);
    setSelectedPostId(null);
  };

  const openCloseModal = (postId: string) => {
    setSelectedPostId(postId);
    setOverflowMenuId(null);
    setShowCloseModal(true);
  };

  const openDeleteModal = (postId: string) => {
    setSelectedPostId(postId);
    setOverflowMenuId(null);
    setShowDeleteModal(true);
  };

  const openEditModal = (post: Post) => {
    setSelectedPost(post);
    setOverflowMenuId(null);
    setShowEditModal(true);
  };

  const refreshPosts = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['approved', 'pending'])
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPosts(data);
    }
  };

  const getMapUrl = (post: Post) => {
    if (post.latitude && post.longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${post.latitude},${post.longitude}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(post.location)}`;
  };

  // Close overflow menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOverflowMenuId(null);
    if (overflowMenuId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [overflowMenuId]);

  if (!user) {
    return null;
  }

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <Header
        onLoginClick={() => setShowAuthModal(true)}
        user={user}
        onLogout={handleLogout}
      />

      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'row',
        overflow: 'hidden',
      }}>
        {/* Sidebar */}
        <div style={{
          width: '224px',
          flexShrink: 0,
          borderRight: '1px solid #f0f0f0',
          background: 'rgba(250, 250, 250, 0.5)',
          overflow: 'hidden',
        }}>
          <Sidebar
            userId={user.id}
            selectedThreadId={null}
            onSelectThread={(threadId) => router.push(`/?thread=${threadId}`)}
            onNavigateToMyActivity={() => {}}
            onLogout={handleLogout}
            activeItem="my-activity"
          />
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: '600px', width: '100%', margin: '0 auto', padding: '24px' }}>
            <h1 style={{ 
              fontSize: '20px', 
              fontWeight: 600, 
              color: '#000',
              marginBottom: '8px',
            }}>
              My activity
            </h1>
            <p style={{ 
              fontSize: '14px', 
              color: '#666',
              marginBottom: '24px',
            }}>
              Posts you've shared that are still visible to others
            </p>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#888' }}>
                Loading...
              </div>
            ) : posts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px' }}>
                <p style={{ color: '#666', marginBottom: '16px' }}>
                  You haven't shared any activities yet.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  style={{
                    background: '#000',
                    color: '#fff',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '24px',
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  Share what I'm doing
                </button>
              </div>
            ) : (
              <div>
                {posts.map((post) => (
                  <div
                    key={post.id}
                    style={{
                      background: '#fff',
                      border: '1px solid #e0e0e0',
                      borderRadius: '16px',
                      padding: '20px',
                      marginBottom: '16px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#000', margin: 0 }}>
                            {post.title}
                          </h3>
                          {post.status === 'pending' && (
                            <span style={{
                              fontSize: '11px',
                              color: '#92400e',
                              background: '#fef3c7',
                              padding: '2px 8px',
                              borderRadius: '10px',
                            }}>
                              Pending review
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: '14px', color: '#666', margin: '0 0 4px 0' }}>
                          <a
                            href={getMapUrl(post)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#666', textDecoration: 'underline' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {post.location}
                          </a>
                        </p>
                        <p style={{ fontSize: '14px', color: '#666', margin: '0 0 4px 0' }}>
                          {post.time}
                        </p>
                        {post.notes && (
                          <p style={{ 
                            fontSize: '15px', 
                            fontStyle: 'italic',
                            color: '#666', 
                            margin: '8px 0 0 0',
                          }}>
                            "{post.notes}"
                          </p>
                        )}
                        {post.preference && post.preference !== 'anyone' && (
                          <span style={{
                            display: 'inline-block',
                            fontSize: '12px',
                            color: '#888',
                            background: '#fafafa',
                            border: '1px solid #e0e0e0',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            marginTop: '8px',
                          }}>
                            {post.preference}
                          </span>
                        )}
                        {post.people_interested > 0 && (
                          <p style={{ fontSize: '13px', color: '#666', marginTop: '12px' }}>
                            {post.people_interested} interested
                          </p>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => handleShare(post)}
                          style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '12px',
                            color: copiedPostId === post.id ? '#4a9d6b' : '#888',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'color 0.15s ease',
                          }}
                        >
                          {copiedPostId === post.id ? '✓ Copied!' : 'Share ↗'}
                        </button>

                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOverflowMenuId(overflowMenuId === post.id ? null : post.id);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              fontSize: '18px',
                              color: '#888',
                              cursor: 'pointer',
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            ⋯
                          </button>

                          {overflowMenuId === post.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                position: 'absolute',
                                right: 0,
                                top: '36px',
                                background: '#fff',
                                border: '1px solid #e0e0e0',
                                borderRadius: '12px',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                                overflow: 'hidden',
                                zIndex: 10,
                                minWidth: '140px',
                              }}
                            >
                              {/* Only show Edit for pending posts */}
                              {post.status === 'pending' && (
                                <button
                                  onClick={() => openEditModal(post)}
                                  style={{
                                    display: 'block',
                                    width: '100%',
                                    padding: '12px 16px',
                                    fontSize: '14px',
                                    color: '#444',
                                    background: 'none',
                                    border: 'none',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = '#fafafa'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                >
                                  Edit
                                </button>
                              )}

                              {/* Only show Close for approved posts */}
                              {post.status === 'approved' && (
                                <button
                                  onClick={() => openCloseModal(post.id)}
                                  style={{
                                    display: 'block',
                                    width: '100%',
                                    padding: '12px 16px',
                                    fontSize: '14px',
                                    color: '#444',
                                    background: 'none',
                                    border: 'none',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = '#fafafa'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                >
                                  Close
                                </button>
                              )}

                              <button
                                onClick={() => openDeleteModal(post.id)}
                                style={{
                                  display: 'block',
                                  width: '100%',
                                  padding: '12px 16px',
                                  fontSize: '14px',
                                  color: '#dc2626',
                                  background: 'none',
                                  border: 'none',
                                  borderTop: '1px solid #f0f0f0',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Close Confirmation Modal */}
      {showCloseModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '16px',
          }}
          onClick={() => setShowCloseModal(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
              Close this post?
            </h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px', lineHeight: 1.5 }}>
              Close a post if you've received enough replies and want to hide it from the feed. People you're already chatting with can still see it.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setShowCloseModal(false)}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 500,
                  border: '1px solid #e0e0e0',
                  borderRadius: '20px',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleClosePost}
                disabled={actionLoading}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '20px',
                  background: '#000',
                  color: '#fff',
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  opacity: actionLoading ? 0.7 : 1,
                }}
              >
                {actionLoading ? 'Closing...' : 'Close post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '16px',
          }}
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
              Delete this post?
            </h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px', lineHeight: 1.5 }}>
              The post will not be viewable by anyone. It will be obscured from any existing message threads. This can't be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 500,
                  border: '1px solid #e0e0e0',
                  borderRadius: '20px',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePost}
                disabled={actionLoading}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '20px',
                  background: '#000',
                  color: '#fff',
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  opacity: actionLoading ? 0.7 : 1,
                }}
              >
                {actionLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => setShowAuthModal(false)}
      />

      <CreatePostModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          refreshPosts();
        }}
      />

      {showEditModal && selectedPost && (
        <EditPostModal
          post={selectedPost}
          onClose={() => {
            setShowEditModal(false);
            setSelectedPost(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedPost(null);
            refreshPosts();
          }}
        />
      )}
    </div>
  );
}