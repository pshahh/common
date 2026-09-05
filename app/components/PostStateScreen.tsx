'use client';

// The centred "this page can't show you a post" block, extracted from
// SinglePostClient so the four post states share one layout instead of the
// friends-only screen standing in for all of them.
//
// Deliberately does NOT include <Header>: the page supplies that, because it
// needs auth props this component has no business knowing about. That also
// leaves the block usable from a future not-found.tsx or error.tsx, neither of
// which exists yet and neither of which has a session to pass.
//
// No new CSS - same sizes, colours and button class as the block it replaces.

interface PostStateScreenProps {
  icon: string;
  title: string;
  body: string;
  cta?: { label: string; onClick: () => void };
}

export default function PostStateScreen({ icon, title, body, cta }: PostStateScreenProps) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>{icon}</div>
      <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', color: '#000' }}>
        {title}
      </h1>
      <p style={{ fontSize: '14px', color: '#888', marginBottom: '24px', lineHeight: 1.5 }}>
        {body}
      </p>
      {cta && (
        <button className="btn btn-primary" onClick={cta.onClick}>
          {cta.label}
        </button>
      )}
    </div>
  );
}
