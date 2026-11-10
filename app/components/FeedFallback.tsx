import Link from 'next/link';
import type { Post } from '../HomeClient';

/**
 * Server-rendered stand-in for the logged-out feed. This is what crawlers and
 * AI assistants read at /, and what people see for the moment before the app
 * takes over (it used to be a bare "Loading..."). Keep it visually close to
 * the logged-out view in HomeClient.tsx.
 */

const REPEATS: Record<string, string> = {
  weekly: 'every week',
  biweekly: 'every other week',
  monthly: 'every month',
};

export default function FeedFallback({ posts }: { posts: Post[] }) {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <header
        className="header"
        style={{
          minHeight: '56px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 0,
        }}
      >
        <Link href="/" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent)', textDecoration: 'none', letterSpacing: '-0.5px' }}>
          common
        </Link>
        <Link href="/?start=login" style={{ fontSize: '14px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
          Log in / Sign up
        </Link>
      </header>

      <main className="main-content">
        <div className="guest-banner">
          <h1 className="page-title">Find people in London to do things with</h1>
          <p className="guest-intro">
            Looking to meet new people and get more from your city? Post a plan, or join someone else&apos;s.{' '}
            <Link href="/welcome" className="guest-intro-link">How it works →</Link>
          </p>
        </div>

        {posts.map((post) => {
          const href = `/post/${post.slug ?? post.id}`;
          const repeats = post.recurrence_rule ? REPEATS[post.recurrence_rule] : null;
          return (
            <article key={post.id} className="card">
              <div className="card-header">
                <div className="card-content">
                  <h2 style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
                    <Link href={href} style={{ color: 'inherit', textDecoration: 'none' }}>
                      {post.title}
                    </Link>
                  </h2>
                  <div className="card-meta">
                    <span className="location-link">{post.location}</span>
                  </div>
                  <div className="card-time" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {post.time}
                    {repeats && (
                      <span className="preference-badge" style={{ margin: 0 }}>
                        {repeats}
                      </span>
                    )}
                  </div>
                  {post.notes && (
                    <div className="card-notes-wrapper">
                      <p className="card-notes card-notes-collapsed" style={{ whiteSpace: 'pre-line' }}>
                        {post.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div
                className="card-footer"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', marginTop: 0 }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div className="poster-name">{post.name}</div>
                  {post.people_interested > 0 && (
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{post.people_interested} interested</span>
                  )}
                </div>
                <Link className="btn btn-primary" href={href}>
                  I&apos;m interested
                </Link>
              </div>
            </article>
          );
        })}
      </main>
    </div>
  );
}
