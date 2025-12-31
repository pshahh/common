import { supabase } from '@/lib/supabase';
import Header from './components/Header';
import PostCard from './components/PostCard';

export default async function Home() {
  // Fetch posts from Supabase
  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FFFFFF' }}>
      <Header isLoggedIn={false} />
      
      <main style={{ maxWidth: '672px', margin: '0 auto', padding: '0 24px' }}>
        {/* Orientation for logged-out users */}
        <div style={{ paddingTop: '32px', paddingBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px' }}>
            Find people to do things with nearby
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Browsing as a guest.{' '}
            <button style={{ textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--text-secondary)' }}>
              Log in
            </button>
            {' '}to post or respond.
          </p>
        </div>

        {/* Action bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '24px' }}>
          <button className="btn-primary">
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
          {error && (
            <p style={{ color: 'red', fontSize: '14px' }}>
              Error loading posts. Please try again.
            </p>
          )}
          
          {posts && posts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
              <p style={{ fontSize: '16px', marginBottom: '8px' }}>Nothing nearby yet.</p>
              <p style={{ fontSize: '14px' }}>Be the first to share what you're doing.</p>
            </div>
          )}
          
          {posts && posts.map((post) => (
            <PostCard 
              key={post.id}
              title={post.title}
              location={post.location}
              time={post.time}
              notes={post.notes}
              name={post.name}
              peopleIn={post.people_interested}
              preference={post.preference !== 'anyone' ? post.preference : undefined}
            />
          ))}
        </div>
      </main>
    </div>
  );
}