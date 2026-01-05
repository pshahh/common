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
  distance?: string | null;
  // Profile info for the author
  authorAvatarUrl?: string | null;
  authorDateOfBirth?: string | null;
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
  distance,
  authorAvatarUrl,
  authorDateOfBirth,
}: PostCardProps) {
  const [showNameTooltip, setShowNameTooltip] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

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

  // Format display name with age
  const displayName = age !== null ? `${name}, ${age}` : name;

  return (
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
                    // TODO: Implement report modal
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
          <button className="btn btn-primary" onClick={onImInterested}>
            I'm interested
          </button>
          {peopleInterested > 0 && (
            <span className="interested-badge">
              {peopleInterested} interested
            </span>
          )}
        </div>
        <div
          className="poster-name"
          onMouseEnter={() => setShowNameTooltip(true)}
          onMouseLeave={() => setShowNameTooltip(false)}
        >
          {name}
          {showNameTooltip && (
            <div className="name-tooltip">
              {authorAvatarUrl ? (
                <div 
                  className="tooltip-avatar"
                  style={{ 
                    backgroundImage: `url(${authorAvatarUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
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
                <span className="tooltip-name">{displayName}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}