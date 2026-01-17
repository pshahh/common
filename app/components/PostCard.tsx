'use client';

import { useState } from 'react';
import { calculateAge, getInitials } from '@/lib/profile';

interface PostCardProps {
  id: string;
  title: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  time: string;
  notes?: string;
  name: string;
  peopleInterested?: number;
  preference?: string;
  isLoggedIn: boolean;
  onImInterested: () => void;
  onReport?: () => void;
  distance?: string | null;
  // Profile info for the author
  authorAvatarUrl?: string | null;
  authorDateOfBirth?: string | null;
  hideInterestButton?: boolean;
}

export default function PostCard({
  id,
  title,
  location,
  latitude,
  longitude,
  time,
  notes,
  name,
  peopleInterested = 0,
  preference,
  isLoggedIn,
  onImInterested,
  onReport,
  distance,
  authorAvatarUrl,
  authorDateOfBirth,
  hideInterestButton = false,
}: PostCardProps) {
  const [showNameTooltip, setShowNameTooltip] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState(false);

  const age = calculateAge(authorDateOfBirth ?? null);

  // Generate Google Maps URL
  const getMapUrl = () => {
    if (latitude && longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/post/${id}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNameClick = () => {
    if (authorAvatarUrl) {
      setShowNameTooltip(false);
      setExpandedPhoto(true);
    }
  };

  return (
    <>
      {/* Expanded photo modal */}
      {expandedPhoto && authorAvatarUrl && (
        <div 
          onClick={() => setExpandedPhoto(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            cursor: 'pointer',
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '400px',
              width: '90%',
              textAlign: 'center',
            }}
          >
            <div style={{
              width: '200px',
              height: '200px',
              borderRadius: '50%',
              backgroundImage: `url(${authorAvatarUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              margin: '0 auto 16px',
            }} />
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>
              {name}
            </h3>
            {age !== null && (
              <p style={{ fontSize: '14px', color: '#666' }}>
                {age} years old
              </p>
            )}
            <button
              onClick={() => setExpandedPhoto(false)}
              style={{
                marginTop: '20px',
                padding: '10px 24px',
                background: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '24px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="card-content">
            <h3 className="card-title">{title}</h3>
            <div className="card-meta">
              <a
                href={getMapUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="location-link"
                onClick={(e) => e.stopPropagation()}
              >
                {location}
              </a>
              {distance && (
                <>
                  <span className="meta-separator">·</span>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>{distance}</span>
                </>
              )}
              <span className="meta-separator">·</span>
              <span>{time}</span>
            </div>
            {notes && <p className="card-notes">{notes}</p>}
            {preference && preference !== 'Anyone' && preference !== 'anyone' && (
              <span className="preference-badge">{preference}</span>
            )}
          </div>
          <div className="card-actions">
            <button 
              className="share-button" 
              onClick={handleShare}
              style={{ color: copied ? 'var(--success)' : undefined }}
            >
              {copied ? '✓ Copied!' : 'Share ↗'}
            </button>
            <div className="menu-container">
              <button
                className="menu-button"
                onClick={() => setShowMenu(!showMenu)}
              >
                ⋯
              </button>
              {showMenu && (
                <div className="dropdown-menu">
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setShowMenu(false);
                      onReport?.();
                    }}
                  >
                    Report post
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="card-footer">
          <div className="footer-left">
            {!hideInterestButton && (
              <button className="btn btn-primary" onClick={onImInterested}>
                I'm interested
              </button>
            )}
            {peopleInterested > 0 && (
              <span className="interested-badge">
                {peopleInterested} interested
              </span>
            )}
          </div>
          <div
            className="poster-name"
            onClick={handleNameClick}
            onMouseEnter={() => setShowNameTooltip(true)}
            onMouseLeave={() => setShowNameTooltip(false)}
            style={{ cursor: authorAvatarUrl ? 'pointer' : 'default' }}
          >
            {name}
            {showNameTooltip && (
              <div className="name-tooltip">
                {authorAvatarUrl ? (
                  <div 
                    className="tooltip-avatar"
                    onClick={handleNameClick}
                    style={{ 
                      backgroundImage: `url(${authorAvatarUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      cursor: 'pointer',
                    }}
                  />
                ) : (
                  <div 
                    className="tooltip-avatar"
                    style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#888',
                    }}
                  >
                    {getInitials(name)}
                  </div>
                )}
                <div className="tooltip-info">
                  <span className="tooltip-name">{name}</span>
                  {age !== null && (
                    <span className="tooltip-since">{age} years old</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}