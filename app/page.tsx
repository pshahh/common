'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import Header from './components/Header';
import PostCard from './components/PostCard';
import AuthModal from './components/AuthModal';
import CreatePostModal from './components/CreatePostModal';
import InterestedModal from './components/InterestedModal';
import MessageSentModal from './components/MessageSentModal';
import Sidebar from './components/Sidebar';
import MessageThread from './components/MessageThread';

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
  const [showMessageSentModal, setShowMessageSentModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
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
    setSelectedThreadId(null);
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
    setShowMessageSentModal(true);
    setSelectedThreadId(threadId);
    refreshPosts();
  };

  const refreshPosts = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPosts(data);
    }
  };

  const handlePostCreated = () => {
    setShowCreateModal(false);
    refreshPosts();
  };

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
  };

  const handleCloseThread = () => {
    setSelectedThreadId(null);
  };

  const handleNavigateToMyActivity = () => {
    console.log('Navigate to My Activity');
  };

  // Logged out view (no sidebar)
  if (!user) {
    return (
      <div className="app">
        <Header
          onLoginClick={() => setShowAuthModal(true)}
          user={user}
          onLogout={handleLogout}
        />

        <main className="main-content">
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
                  isLoggedIn={false}
                  onImInterested={() => handleInterestedClick(post)}
                />
              ))}
            </div>
          )}
        </main>

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => setShowAuthModal(false)}
        />
      </div>
    );
  }

  // Logged in view (with fixed sidebars)
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

      {/* Main layout */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'row',
        overflow: 'hidden',
      }}>
        {/* Left Sidebar - Fixed */}
        <div style={{
          width: '224px',
          flexShrink: 0,
          borderRight: '1px solid #f0f0f0',
          background: 'rgba(250, 250, 250, 0.5)',
          overflow: 'hidden',
        }}>
          <Sidebar
            userId={user.id}
            selectedThreadId={selectedThreadId}
            onSelectThread={handleSelectThread}
            onNavigateToMyActivity={handleNavigateToMyActivity}
          />
        </div>

        {/* Feed - Scrollable */}
        <div 
          style={{ 
            flex: 1, 
            overflowY: 'auto',
            opacity: selectedThreadId ? 0.4 : 1,
            pointerEvents: selectedThreadId ? 'none' : 'auto',
            transition: 'opacity 0.2s ease',
          }}
        >
          <div style={{ maxWidth: '600px', width: '100%', margin: '0 auto', padding: '24px' }}>
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
                    isLoggedIn={true}
                    onImInterested={() => handleInterestedClick(post)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Message Thread - Fixed */}
        {selectedThreadId && (
          <div style={{
            width: '384px',
            flexShrink: 0,
            borderLeft: '1px solid #f0f0f0',
            background: '#fff',
            overflow: 'hidden',
          }}>
            <MessageThread
              key={selectedThreadId}
              threadId={selectedThreadId}
              currentUserId={user.id}
              onClose={handleCloseThread}
            />
          </div>
        )}
      </div>

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
      {showInterestedModal && selectedPost && (
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
      {showMessageSentModal && (
        <MessageSentModal
          onClose={() => setShowMessageSentModal(false)}
        />
      )}
    </div>
  );
}