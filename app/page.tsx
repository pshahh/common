import Header from './components/Header';
import PostCard from './components/PostCard';

export default function Home() {
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
          <PostCard 
            title="Dog walking"
            location="Clissold Park"
            time="weekday evenings"
            name="Adam"
            peopleIn={3}
          />
          <PostCard 
            title="Beginners only chess"
            location="Alpaca pub, Angel"
            time="tonight"
            name="Jim"
          />
          <PostCard 
            title="Sketching / Painting in a park"
            location="Hyde Park"
            time="Sundays"
            notes="Beginner artists"
            name="Lona"
            preference="Women preferred"
          />
          <PostCard 
            title="Pub quiz"
            location="The Crown, Stoke Newington"
            time="Tomorrow evening"
            notes="Looking for 2 people"
            name="Mo"
            peopleIn={1}
          />
        </div>
      </main>
    </div>
  );
}