'use client';

interface MessageSentModalProps {
  onClose: () => void;
  onViewMessages?: () => void;
}

export default function MessageSentModal({
  onClose,
  onViewMessages,
}: MessageSentModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal confirmation-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirmation-content">
          <div className="confirmation-icon success">
            <span>✓</span>
          </div>
          <h2 className="confirmation-title">Message sent</h2>
          <p className="confirmation-text">
            You'll be notified when they reply.
          </p>
          <div className="confirmation-actions">
            <button className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}