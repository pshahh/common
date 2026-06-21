'use client';

interface FloatingActionButtonProps {
  onClick: () => void;
}

export default function FloatingActionButton({ onClick }: FloatingActionButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label="Share what I'm doing"
      style={{
        position: 'fixed',
        bottom: 'calc(96px + env(safe-area-inset-bottom))',
        right: '20px',
        height: '44px',
        borderRadius: '22px',
        padding: '0 16px 0 12px',
        background: 'var(--accent)',
        color: 'white',
        border: 'none',
        boxShadow: '0 2px 12px rgba(15, 68, 21, 0.3)',
        cursor: 'pointer',
        zIndex: 45,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        fontSize: '14px',
        fontWeight: 600,
        fontFamily: 'inherit',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onTouchStart={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.93)';
      }}
      onTouchEnd={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      Post
    </button>
  );
}