'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { isUUID } from '@/lib/slug';
import { User } from '@supabase/supabase-js';
import posthog from 'posthog-js';
import { getPostType } from '@/lib/postType';
import Header from '../../components/Header';
import PostCard from '../../components/PostCard';
import AuthModal from '../../components/AuthModal';
import InterestedModal from '../../components/InterestedModal';
import MessageSentModal from '../../components/MessageSentModal';
import ClosedBadge from '../../components/ClosedBadge';
import PostStateScreen from '../../components/PostStateScreen';

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
  thread_type: string | null;
  audience: 'everyone' | 'friends';
  next_occurrence_at: string | null;
}

// Why the post can't be shown, resolved server-side in page.tsx with the
// service role key. The client cannot work this out for itself: RLS returns an
// empty result for a friends-only post and for a deleted one alike, which is
// exactly how every dead link ended up claiming to be friends-only.
//
// null means "the post exists and is in principle viewable" - if the client's
// own RLS-scoped fetch then comes back empty, that genuinely is the
// friends-only case.
export type PostUnavailableReason = 'removed' | 'not_found' | null;

interface SinglePostClientProps {
  postId: string;
  unavailableReason?: PostUnavailableReason;
}

export default function SinglePostClient({ postId, unavailableReason = null }: SinglePostClientProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalTrigger, setAuthModalTrigger] = useState<'interested' | 'post' | 'nav'>('nav');
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
      // The server already resolved that there is nothing to show. Skip the
      // round trip - it would return empty and tell us nothing we don't know.
      if (unavailableReason) {
        setLoading(false);
        return;
      }
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
  }, [postId, unavailableReason]);

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
      posthog.capture('post_card_opened', {
        post_id: post.id,
        post_type: getPostType(post.recurrence_rule),
        position: null,
      });
    } else {
      posthog.capture('interested_clicked', {
        post_id: post.id,
        post_type: getPostType(post.recurrence_rule),
        position: null,
      });
      setAuthModalTrigger('interested');
      setShowAuthModal(true);
    }
  };

  const handleInterestedSuccess = (threadId: string, messageSent: boolean) => {
    setShowInterestedModal(false);
    setHasExpressedInterest(true);

    if (messageSent) {
      // 1:1 flow - show message sent modal
      setShowMessageSentModal(true);
    } else {
      // Group join - go to homepage with thread open
      router.push(`/?thread=${threadId}`);
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

  if (unavailableReason || notFound || !post) {
    // Three distinct states, not one. The server tells us which via
    // unavailableReason; when it says nothing, the post exists and is viewable
    // in principle, so an empty client fetch means RLS hid a friends-only post
    // from this viewer - the only case the original screen was ever right for.
    //
    // Deliberately no post content in any of them: the reason is enough, and
    // leaking a title would defeat the friends-only case entirely.
    const screen =
      unavailableReason === 'removed'
        ? {
            // Covers deleted, rejected, hidden and archived posts. Does NOT
            // distinguish "the poster took it down" from "an admin removed
            // it" - the viewer doesn't need to know which, and naming the
            // poster's action invites questions we don't want to field.
            icon: '🚫',
            title: 'This post has been removed',
            body: "It's no longer available. There's plenty else happening nearby.",
            cta: { label: 'Browse all posts', onClick: handleBackToFeed },
          }
        : unavailableReason === 'not_found'
        ? {
            icon: '🔍',
            title: "We couldn't find that post",
            body: 'The link may be incomplete, or the post may no longer exist.',
            cta: { label: 'Browse all posts', onClick: handleBackToFeed },
          }
        : {
            // Genuinely friends-only. The CTA still splits: a logged-out
            // visitor is nudged to sign in, a logged-in one (signed in, just
            // not friends with the poster) is sent back to the feed.
            icon: '🔒',
            title: "This one's just for friends",
            body: 'Some plans on common are shared with friends only. Sign in to connect with friends and join their activities.',
            cta: user
              ? { label: 'Browse all posts', onClick: handleBackToFeed }
              : { label: 'Log in or sign up', onClick: () => setShowAuthModal(true) },
          };

    return (
      <div className="app">
        <Header
          onLoginClick={() => setShowAuthModal(true)}
          user={user}
          onLogout={handleLogout}
        />
        <main className="main-content">
          <PostStateScreen
            icon={screen.icon}
            title={screen.title}
            body={screen.body}
            cta={screen.cta}
          />
        </main>
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => setShowAuthModal(false)}
          trigger={authModalTrigger}
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
            color: 'var(--text-primary)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          ← See what else is going on
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
          audience={post.audience}
          isAdmin={isAdmin}
          onAdminRemove={() => setShowAdminRemoveModal(true)}
          nextOccurrenceAt={post.next_occurrence_at}
        />
        
      </main>
      {/* Modals */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => setShowAuthModal(false)}
        trigger={authModalTrigger}
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
              background: '#FEFCF8',
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
                  border: '1px solid #E5DFD8',
                  borderRadius: '24px',
                  background: '#FEFCF8',
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