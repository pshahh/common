'use client';

interface BlockUserModalProps {
  // Defaults to "Block this person?". Group conversations name the person picked.
  title?: string;
  loading: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

// Confirmation for blocking someone, shared by the post ⋯ menu and the
// conversation menu so both read the same.
export default function BlockUserModal({ title = 'Block this person?', loading, error, onCancel, onConfirm }: BlockUserModalProps) {
  return (
    <div
      onClick={() => !loading && onCancel()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--bg-card)', borderRadius: '16px', padding: '24px',
        maxWidth: '340px', width: '100%', margin: '0 16px',
      }}>
        <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
          {title}
        </div>
        <div style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '20px', lineHeight: 1.5 }}>
          You won&apos;t see their posts and will be removed from any shared conversations. They won&apos;t be notified that you&apos;ve blocked them.
        </div>
        {error && (
          <p style={{ fontSize: '14px', color: 'var(--danger)', marginBottom: '16px' }}>
            {error}
          </p>
        )}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '10px 20px', borderRadius: '20px', fontSize: '14px',
              fontWeight: 500, border: '1px solid var(--border)', background: 'var(--bg-card)',
              cursor: loading ? 'not-allowed' : 'pointer', color: 'var(--text-primary)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '10px 20px', borderRadius: '20px', fontSize: '14px',
              fontWeight: 500, border: 'none', background: 'var(--accent)',
              cursor: loading ? 'not-allowed' : 'pointer',
              color: 'var(--text-inverse)', opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Blocking...' : 'Block'}
          </button>
        </div>
      </div>
    </div>
  );
}
