'use client';

interface ReportConfirmationModalProps {
  onClose: () => void;
}

export default function ReportConfirmationModal({ onClose }: ReportConfirmationModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '400px',
          padding: '40px 32px',
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: '#f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: '20px',
          }}
        >
          ⚑
        </div>

        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
          Report submitted
        </h2>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '24px', lineHeight: 1.5 }}>
          Thanks for letting us know. We'll review this against our guidelines.
        </p>

        <button
          onClick={onClose}
          style={{
            padding: '12px 24px',
            border: 'none',
            borderRadius: '24px',
            background: '#000',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}