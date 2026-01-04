'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import Header from '../../components/Header';
import PostCard from '../../components/PostCard';
import AuthModal from '../../components/AuthModal';
import InterestedModal from '../../components/InterestedModal';
import MessageSentModal from '../../components/MessageSentModal';

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
}

export default function SinglePostPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showInterestedModal, setShowInterestedModal] = useState(false);
  const [showMessageSentModal, setShowMessageSentModal] = useState(false);

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

  // Fetch the post
  useEffect(() => {
    async function fetchPost() {
      if (!postId) return;

      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .eq('status', 'approved')
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
      setShowInterestedModal(true);
    } else {
      setShowAuthModal(true);
    }
  };

  const handleInterestedSuccess = (threadId: string) => {
    setShowInterestedModal(false);
    setShowMessageSentModal(true);
    // Refresh post to update interested count
    refreshPost();
  };

  const refreshPost = async () => {
    if (!postId) return;
    
    const { data } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .eq('status', 'approved')
      .single();

    if (data) {
      setPost(data);
    }
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
          peopleInterested={post.people_interested}
          preference={post.preference || undefined}
          isLoggedIn={!!user}
          onImInterested={handleInterestedClick}
        />

        {/* Prompt for logged out users */}
        {!user && (
          <div style={{
            marginTop: '24px',
            padding: '20px',
            background: '#fafafa',
            borderRadius: '12px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '14px', color: '#444', marginBottom: '16px' }}>
              Want to join? Create an account to express interest and message the organiser.
            </p>
            <button 
              className="btn btn-primary"
              onClick={() => setShowAuthModal(true)}
            >
              Log in / Sign up
            </button>
          </div>
        )}
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
        />
      )}
    </div>
  );
}