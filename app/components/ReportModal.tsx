'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface ReportModalProps {
  postId?: string;
  threadId?: string;
  reportedBy: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReportModal({
  postId,
  threadId,
  reportedBy,
  onClose,
  onSuccess,
}: ReportModalProps) {
  const [reason, setReason] = useState('');
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const predefinedReasons = [
    'Spam or misleading',
    'Inappropriate content',
    'Harassment or abuse',
    'Safety concern',
    'Other',
  ];

  const handleSubmit = async () => {
    if (!selectedReason) {
      setError('Please select a reason');
      return;
    }

    setSubmitting(true);
    setError(null);

    const finalReason = selectedReason === 'Other' 
      ? reason.trim() || 'Other (no details provided)'
      : selectedReason;

    const { error: insertError } = await supabase
      .from('reports')
      .insert({
        post_id: postId || null,
        thread_id: threadId || null,
        reported_by: reportedBy,
        reason: finalReason,
      });

    if (insertError) {
      console.error('Error submitting report:', insertError);
      setError('Failed to submit report. Please try again.');
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onSuccess();
  };

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
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
            Report {postId ? 'post' : 'conversation'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              color: '#888',
              cursor: 'pointer',
              lineHeight: 1,
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
            Why are you reporting this? Your report is anonymous.
          </p>

          {/* Reason options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {predefinedReasons.map((r) => (
              <button
                key={r}
                onClick={() => setSelectedReason(r)}
                style={{
                  padding: '12px 16px',
                  border: '1px solid',
                  borderColor: selectedReason === r ? '#000' : '#e0e0e0',
                  borderRadius: '12px',
                  background: selectedReason === r ? '#fafafa' : '#fff',
                  fontSize: '14px',
                  color: '#444',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Additional details for "Other" */}
          {selectedReason === 'Other' && (
            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  marginBottom: '8px',
                }}
              >
                Please describe the issue
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Tell us more about the problem..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '12px',
                  fontSize: '14px',
                  outline: 'none',
                  resize: 'none',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {error && (
            <p style={{ fontSize: '14px', color: '#dc2626', marginBottom: '16px' }}>
              {error}
            </p>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{
                padding: '12px 24px',
                border: '1px solid #e0e0e0',
                borderRadius: '24px',
                background: '#fff',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !selectedReason}
              style={{
                padding: '12px 24px',
                border: 'none',
                borderRadius: '24px',
                background: selectedReason ? '#000' : '#e0e0e0',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: selectedReason && !submitting ? 'pointer' : 'not-allowed',
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Submitting...' : 'Submit report'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}