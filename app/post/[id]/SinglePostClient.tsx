'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { isUUID } from '@/lib/slug';
import { User } from '@supabase/supabase-js';
import Header from '../../components/Header';
import PostCard from '../../components/PostCard';
import AuthModal from '../../components/AuthModal';
import InterestedModal from '../../components/InterestedModal';
import MessageSentModal from '../../components/MessageSentModal';
import ClosedBadge from '../../components/ClosedBadge';

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
  status: string;
  recurrence_rule: string | null;
  expires_at: string | null;
  slug: string | null;
}

interface SinglePostClientProps {
  postId: string;
}

export default function SinglePostClient({ postId }: SinglePostClientProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showInterestedModal, setShowInterestedModal] = useState(false);
  const [showMessageSentModal, setShowMessageSentModal] = useState(false);
  const [hasExpressedInterest, setHasExpressedInterest] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminRemoveModal, setShowAdminRemoveModal] = useState(false);
  const [adminRemoveLoading, setAdminRemoveLoading] = useState(false);

  // Check auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Check if user is admin
  useEffect(() => {
    async function checkAdmin() {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();
      if (data?.is_admin) setIsAdmin(true);
    }
    checkAdmin();
  }, [user]);

  // Fetch the post
  useEffect(() => {
    async function fetchPost() {
      if (!postId) return;
      const column = isUUID(postId) ? 'id' : 'slug';
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq(column, postId)
        .in('status', ['approved', 'closed'])
        .single();

      if (error || !data) {
        console.error('Error fetching post:', error);
        setNotFound(true);
      } else {
        setPost(data);
      }
      setLoading(false);
    }
    fetchPost();
  }, [postId]);

  const searchParams = useSearchParams();

// Auto-open interested modal if redirected after signup
useEffect(() => {
  const action = searchParams.get('action');
  const isExpired = post?.expires_at ? new Date(post.expires_at) < new Date() : false;
  if (action === 'interested' && user && post && post.user_id !== user.id && post.status !== 'closed' && !isExpired) {
    setShowInterestedModal(true);
    window.history.replaceState({}, '', `/post/${postId}`);
  }
}, [user, post, searchParams, postId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleInterestedClick = () => {
    if (!post) return;
    if (user) {
      if (post.user_id === user.id) {
        alert("You can't express interest in your own post");
        return;
      }
      // Block interest on closed or expired posts
      const isExpired = post.expires_at ? new Date(post.expires_at) < new Date() : false;
      if (post.status === 'closed' || isExpired) {
        return;
      }
      setShowInterestedModal(true);
    } else {
      setShowAuthModal(true);
    }
  };

  const handleInterestedSuccess = (threadId: string, messageSent: boolean) => {
    setShowInterestedModal(false);
    setHasExpressedInterest(true);

    if (messageSent) {
      // User sent a message - show message sent modal
      setShowMessageSentModal(true);
    }
    
    // Refresh post to update interested count
    refreshPost();
  };

  const refreshPost = async () => {
    if (!postId) return;
    const column = isUUID(postId) ? 'id' : 'slug';
    const { data } = await supabase
      .from('posts')
      .select('*')
      .eq(column, postId)
      .in('status', ['approved', 'closed'])
      .single();
    if (data) {
      setPost(data);
    }
  };

  const handleAdminRemoveConfirm = async () => {
    if (!post) return;
    setAdminRemoveLoading(true);

    const { error } = await supabase
      .from('posts')
      .update({ status: 'hidden' })
      .eq('id', post.id);

    if (error) {
      console.error('Error removing post:', error);
      alert('Failed to remove post. Please try again.');
      setAdminRemoveLoading(false);
      return;
    }

    // Send removal notification
    try {
      await supabase.functions.invoke('post-moderation-notification', {
        body: {
          postId: post.id,
          userId: post.user_id,
          postTitle: post.title,
          action: 'removed',
        },
      });
    } catch (emailError) {
      console.error('Failed to send removal email:', emailError);
    }

    setAdminRemoveLoading(false);
    setShowAdminRemoveModal(false);
    router.push('/');
  };

  const handleBackToFeed = () => {
    router.push('/');
  };

  if (loading) {
    return (
      <div className="app">
        <Header
          onLoginClick={() => setShowAuthModal(true)}
          user={user}
          onLogout={handleLogout}
        />
        <main className="main-content">
          <div className="loading-state">Loading...</div>
        </main>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="app">
        <Header
          onLoginClick={() => setShowAuthModal(true)}
          user={user}
          onLogout={handleLogout}
        />
        <main className="main-content">
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', color: '#000' }}>
              Post not found
            </h1>
            <p style={{ fontSize: '14px', color: '#888', marginBottom: '24px' }}>
              This post may have been removed or is no longer available.
            </p>
            <button className="btn btn-primary" onClick={handleBackToFeed}>
              Browse all posts
            </button>
          </div>
        </main>
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => setShowAuthModal(false)}
        />
      </div>
    );
  }

  const isExpired = post?.expires_at ? new Date(post.expires_at) < new Date() : false;
  const isClosedOrExpired = post?.status === 'closed' || isExpired;

  return (
    <div className="app">
      <Header
        onLoginClick={() => setShowAuthModal(true)}
        user={user}
        onLogout={handleLogout}
      />
      <main className="main-content">
        {/* Back link */}
        <button
          onClick={handleBackToFeed}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            marginBottom: '20px',
            fontSize: '14px',
            color: '#888',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          ← Explore other things happening near you
        </button>
        {/* Post card */}
        <PostCard
          id={post.id}
          title={post.title}
          location={post.location}
          latitude={post.latitude}
          longitude={post.longitude}
          time={post.time}
          notes={post.notes || undefined}
          name={post.name}
          peopleInterested={post.people_interested + (hasExpressedInterest ? 1 : 0)}
          preference={post.preference || undefined}
          isLoggedIn={!!user}
          onImInterested={handleInterestedClick}
          hideInterestButton={hasExpressedInterest}
          status={isClosedOrExpired ? 'closed' : post.status}
          recurrenceRule={post.recurrence_rule}
          slug={post.slug}
          isAdmin={isAdmin}
          onAdminRemove={() => setShowAdminRemoveModal(true)}
        />
        
      </main>
      {/* Modals */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => setShowAuthModal(false)}
      />
      {showInterestedModal && post && user && (
        <InterestedModal
          post={post}
          currentUserId={user.id}
          onClose={() => setShowInterestedModal(false)}
          onSuccess={handleInterestedSuccess}
        />
      )}
      {showMessageSentModal && (
        <MessageSentModal
          onClose={() => setShowMessageSentModal(false)}
          onCreatePost={() => {
            setShowMessageSentModal(false);
            router.push('/');
          }}
          createPostLabel="Explore other activities"
        />
      )}

      {/* Admin Remove Post Modal */}
      {showAdminRemoveModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
            padding: '16px',
          }}
          onClick={() => !adminRemoveLoading && setShowAdminRemoveModal(false)}
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
              Remove this post?
            </h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px', lineHeight: 1.5 }}>
              This will hide the post from the feed and notify the poster that it was removed.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAdminRemoveModal(false)}
                disabled={adminRemoveLoading}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 500,
                  border: '1px solid #e0e0e0',
                  borderRadius: '24px',
                  background: '#fff',
                  cursor: adminRemoveLoading ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAdminRemoveConfirm}
                disabled={adminRemoveLoading}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '24px',
                  background: '#dc2626',
                  color: '#fff',
                  cursor: adminRemoveLoading ? 'not-allowed' : 'pointer',
                  opacity: adminRemoveLoading ? 0.6 : 1,
                }}
              >
                {adminRemoveLoading ? 'Removing...' : 'Remove post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}