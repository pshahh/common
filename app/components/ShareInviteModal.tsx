'use client';

import { useState } from 'react';

interface ShareInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  avatarUrl: string | null;
  shareUrl: string;
}

export default function ShareInviteModal({
  isOpen,
  onClose,
  userName,
  avatarUrl,
  shareUrl,
}: ShareInviteModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  async function copyToClipboard(text: string): Promise<boolean> {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for mobile / non-HTTPS
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      document.body.removeChild(textarea);
      return false;
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Be friends on common',
          url: shareUrl,
        });
      } catch (e) {
        // User cancelled
      }
    } else {
      await copyToClipboard(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    // Mark as shared so next time we skip the preview
    localStorage.setItem('common_has_shared_invite', 'true');
    onClose();
  };

  const handleCopyLink = async () => {
    await copyToClipboard(shareUrl);
    setCopied(true);
    localStorage.setItem('common_has_shared_invite', 'true');
    setTimeout(() => {
      setCopied(false);
      onClose();
    }, 1500);
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '400px', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 24px 0',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
            Share your friendship link
          </h2>
          <button
            onClick={onClose}
            className="modal-close"
            style={{
              background: 'none', border: 'none', fontSize: '20px',
              color: 'var(--text-secondary)', cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '20px 24px 24px' }}>
          {/* Preview label */}
          <p style={{
            fontSize: '13px', color: 'var(--text-secondary)',
            marginBottom: '16px',
          }}>
            Here's what your friends will see when they open your link:
          </p>

          {/* Mini connect page preview */}
          <div style={{
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '24px 20px',
            background: 'var(--bg-subtle)',
            textAlign: 'center',
            marginBottom: '24px',
          }}>
            {/* Mini common wordmark */}
            <div style={{
              fontSize: '14px', fontWeight: 700, color: 'var(--accent)',
              letterSpacing: '-0.3px', marginBottom: '16px',
            }}>
              common
            </div>

            {/* Mini avatar */}
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'var(--bg-badge)', border: '1.5px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px', overflow: 'hidden',
            }}>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={userName}
                  width={200}
                  height={200}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{
                  fontSize: '22px', fontWeight: 600, color: 'var(--text-secondary)',
                }}>
                  {userName?.[0] || '?'}
                </span>
              )}
            </div>

            {/* Mini headline */}
            <div style={{
              fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)',
              lineHeight: 1.3, marginBottom: '10px',
            }}>
              {userName} wants to make more memories with you
            </div>

            {/* Mini button (non-interactive, just visual) */}
            <div style={{
              background: 'var(--accent)', color: 'var(--text-inverse)',
              padding: '8px 20px', borderRadius: '20px',
              fontSize: '13px', fontWeight: 600,
              display: 'inline-block',
              marginBottom: '10px',
            }}>
              Be friends
            </div>

            {/* Mini subtext */}
            <div style={{
              fontSize: '11px', color: '#666',
              lineHeight: 1.5,
            }}>
              Become friends on common to see what {userName}'s up to and get involved. They'll see your plans too.
            </div>
          </div>

          {/* Share URL display */}
          <div style={{
            background: 'var(--bg-badge)',
            border: '1px solid var(--border-light)',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            marginBottom: '20px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {shareUrl}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {/* Copy link button */}
            <button
              onClick={handleCopyLink}
              style={{
                flex: 1,
                padding: '14px 20px',
                borderRadius: '24px',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {copied ? '✓ Copied!' : 'Copy link'}
            </button>

            {/* Share button (shows native share on mobile, acts as primary CTA) */}
            <button
              onClick={handleShare}
              style={{
                flex: 1,
                padding: '14px 20px',
                borderRadius: '24px',
                border: 'none',
                background: 'var(--accent)',
                color: 'var(--text-inverse)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}