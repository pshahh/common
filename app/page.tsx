'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Header from './components/Header';
import PostCard from './components/PostCard';
import AuthModal from './components/AuthModal';
import CreatePostModal from './components/CreatePostModal';

interface Post {
  id: string;
  title: string;
  location: string;
  time: string;
  notes?: string;
  name: string;
  people_interested: number;
  preference?: string;
}

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPostConfirmation, setShowPostConfirmation] = useState(false);

  // Check auth state and fetch posts
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
    };

    const fetchPosts = async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setPosts(data);
      }
      setLoading(false);
    };

    checkAuth();
    fetchPosts();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

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

  const handleAuthSuccess = () => {
    setIsLoggedIn(true);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FFFFFF' }}>
      <Header 
        isLoggedIn={isLoggedIn} 
        onLoginClick={() => setShowAuthModal(true)}
      />
      
      <main style={{ maxWidth: '672px', margin: '0 auto', padding: '0 24px' }}>
        {/* Orientation for logged-out users */}
        {!isLoggedIn && (
          <div style={{ paddingTop: '32px', paddingBottom: '24px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px' }}>
              Find people to do things with nearby
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Browsing as a guest.{' '}
              <button 
                onClick={() => setShowAuthModal(true)}
                style={{ 
                  textDecoration: 'underline', 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer', 
                  fontSize: '14px', 
                  color: 'var(--text-secondary)' 
                }}
              >
                Log in
              </button>
              {' '}to post or respond.
            </p>
          </div>
        )}

        {/* Spacer for logged-in users */}
        {isLoggedIn && <div style={{ paddingTop: '32px' }} />}

        {/* Action bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '24px' }}>
          <button 
            className="btn-accent"
            onClick={() => {
              if (!isLoggedIn) {
                setShowAuthModal(true);
              } else {
                setShowCreateModal(true);
              }
            }}
          >
            Share what I'm doing
          </button>
          
          <select style={{ 
            fontSize: '14px', 
            color: 'var(--text-secondary)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer'
          }}>
            <option>Sort by: nearest</option>
            <option>Sort by: happening soon</option>
            <option>Sort by: recently added</option>
          </select>
        </div>

        {/* Post cards */}
        <div>
          {loading && (
            <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '48px 0' }}>
              Loading...
            </p>
          )}
          
          {!loading && posts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
              <p style={{ fontSize: '16px', marginBottom: '8px' }}>Nothing nearby yet.</p>
              <p style={{ fontSize: '14px' }}>Be the first to share what you're doing.</p>
            </div>
          )}
          
          {posts.map((post) => (
            <PostCard 
              key={post.id}
              title={post.title}
              location={post.location}
              time={post.time}
              notes={post.notes}
              name={post.name}
              peopleIn={post.people_interested}
              preference={post.preference !== 'anyone' ? post.preference : undefined}
              onInterestedClick={() => {
                if (!isLoggedIn) {
                  setShowAuthModal(true);
                } else {
                  // TODO: Handle interest
                  alert('Interest flow coming soon!');
                }
              }}
            />
          ))}
        </div>
      </main>

      <AuthModal 
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />

      <CreatePostModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          setShowPostConfirmation(true);
        }}
      />

      {showPostConfirmation && (
  <div 
    style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      padding: '16px',
    }}
    onClick={() => setShowPostConfirmation(false)}
  >
    <div 
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '400px',
        padding: '32px',
        textAlign: 'center',
      }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{
        width: '48px',
        height: '48px',
        backgroundColor: 'var(--success-light)',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 16px',
        fontSize: '24px',
      }}>
        ✓
      </div>
      <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
        Thanks
      </h3>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
        We're checking this now. It should appear shortly.
      </p>
      <button 
        className="btn-primary"
        onClick={() => setShowPostConfirmation(false)}
      >
        Done
      </button>
    </div>
  </div>
)}
    </div>
  );
}