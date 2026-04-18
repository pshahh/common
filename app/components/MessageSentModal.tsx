'use client';

interface MessageSentModalProps {
  onClose: () => void;
  onViewMessages?: () => void;
  onCreatePost?: () => void;
  createPostLabel?: string;
}

export default function MessageSentModal({
  onClose,
  onViewMessages,
  onCreatePost,
  createPostLabel = 'Share your own activity',
}: MessageSentModalProps) {
  return (
    <div className="modal-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div
        className="modal confirmation-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'relative' }}
      >
        <button
          className="modal-close"
          onClick={onClose}
          style={{ position: 'absolute', top: '12px', right: '12px' }}
        >
          ×
        </button>
        <div className="confirmation-content">
          <div className="confirmation-icon success">
            <span>✓</span>
          </div>
          <h2 className="confirmation-title">Message sent</h2>
          <p className="confirmation-text">
            You'll be notified when they reply.
          </p>
          {onCreatePost && (
            <div className="confirmation-actions">
              <button className="btn btn-primary" onClick={onCreatePost}>
                {createPostLabel}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}