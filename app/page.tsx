'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import Header from './components/Header';
import PostCard from './components/PostCard';
import AuthModal from './components/AuthModal';
import CreatePostModal from './components/CreatePostModal';
import InterestedModal from './components/InterestedModal';

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
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInterestedModal, setShowInterestedModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [sortBy, setSortBy] = useState('nearest');

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

  // Fetch posts
  useEffect(() => {
    async function fetchPosts() {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching posts:', error);
      } else {
        setPosts(data || []);
      }
      setLoading(false);
    }

    fetchPosts();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleShareClick = () => {
    if (user) {
      setShowCreateModal(true);
    } else {
      setShowAuthModal(true);
    }
  };

  const handleInterestedClick = (post: Post) => {
    if (user) {
      // Check if user is trying to join their own post
      if (post.user_id === user.id) {
        alert("You can't express interest in your own post");
        return;
      }
      setSelectedPost(post);
      setShowInterestedModal(true);
    } else {
      setShowAuthModal(true);
    }
  };

  const handleInterestedSuccess = (threadId: string) => {
    setShowInterestedModal(false);
    setSelectedPost(null);
    // Could navigate to messages or show a success state
    // For now, refresh posts to update interested count
    window.location.reload();
  };

  const handlePostCreated = () => {
    setShowCreateModal(false);
    // Refresh posts
    window.location.reload();
  };

  return (
    <div className="app">
      <Header
        onLoginClick={() => setShowAuthModal(true)}
        user={user}
        onLogout={handleLogout}
      />

      <main className="main-content">
        {!user && (
          <div className="guest-banner">
            <h1 className="page-title">Find people to do things with nearby</h1>
            <p className="page-subtitle">
              Browsing as a guest.{' '}
              <button
                className="text-link"
                onClick={() => setShowAuthModal(true)}
              >
                Log in
              </button>{' '}
              to post or respond.
            </p>
          </div>
        )}

        <div className="feed-header">
          <button className="btn btn-primary" onClick={handleShareClick}>
            Share what I'm doing
          </button>
          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="nearest">Sort by: nearest</option>
            <option value="soon">Sort by: happening soon</option>
            <option value="recent">Sort by: recently added</option>
          </select>
        </div>

        {loading ? (
          <div className="loading-state">Loading...</div>
        ) : posts.length === 0 ? (
          <div className="empty-state">
            <p>Nothing nearby yet. Be the first to share what you're doing.</p>
            <button className="btn btn-primary" onClick={handleShareClick}>
              Share what I'm doing
            </button>
          </div>
        ) : (
          <div className="feed">
            {posts.map((post) => (
              <PostCard
                key={post.id}
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
                onImInterested={() => handleInterestedClick(post)}
              />
            ))}
          </div>
        )}
      </main>

     {/* Modals */}
     <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => setShowAuthModal(false)}
      />

      <CreatePostModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handlePostCreated}
      />

      {showInterestedModal && selectedPost && user && (
        <InterestedModal
          post={selectedPost}
          currentUserId={user.id}
          onClose={() => {
            setShowInterestedModal(false);
            setSelectedPost(null);
          }}
          onSuccess={handleInterestedSuccess}
        />
      )}
    </div>
  );
}