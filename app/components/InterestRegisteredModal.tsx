'use client';

interface InterestRegisteredModalProps {
  posterName: string;
  onClose: () => void;
}

export default function InterestRegisteredModal({
  posterName,
  onClose,
}: InterestRegisteredModalProps) {
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
          <h2 className="confirmation-title">You're interested</h2>
          <p className="confirmation-text">
            We've let {posterName} know. You can send them a message whenever you're ready.
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