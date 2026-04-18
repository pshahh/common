'use client';

import { useState, useEffect, useRef } from 'react';
import { calculateAge, getInitials } from '@/lib/profile';
import ClosedBadge from './ClosedBadge';
import { renderTextWithLinks } from '@/lib/textUtils';

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
  status?: string;
  recurrenceRule?: string | null;
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
  status,
  recurrenceRule,
}: PostCardProps) {
  const [showNameTooltip, setShowNameTooltip] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [notesTruncated, setNotesTruncated] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLParagraphElement>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  // Calculate fixed tooltip position clamped to viewport
  useEffect(() => {
    if (showNameTooltip && nameRef.current) {
      const rect = nameRef.current.getBoundingClientRect();
      const tooltipWidth = 200;
      const tooltipHeight = 70;
      const padding = 8;

      let left = rect.left;
      let top = rect.top - tooltipHeight - padding;

      // Clamp horizontally
      if (left + tooltipWidth > window.innerWidth - padding) {
        left = window.innerWidth - tooltipWidth - padding;
      }
      if (left < padding) {
        left = padding;
      }

      // If not enough room above, show below
      if (top < padding) {
        top = rect.bottom + padding;
      }

      setTooltipStyle({
        position: 'fixed' as const,
        top: `${top}px`,
        left: `${left}px`,
        width: `${tooltipWidth}px`,
      });
    }
  }, [showNameTooltip]);

  // Detect if notes text overflows the clamped height
  useEffect(() => {
    if (notesRef.current) {
      setNotesTruncated(notesRef.current.scrollHeight > notesRef.current.clientHeight + 1);
    }
  }, [notes]);

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
  <h3 style={{ 
    fontSize: '16px', 
    fontWeight: 600, 
    color: '#000',
    margin: 0,
  }}>
    {title}
  </h3>
  {status === 'closed' && <ClosedBadge />}
</div>
            {/* Location line */}
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
            </div>
            {/* Time on separate line */}
<div className="card-time" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
  {time}
  {recurrenceRule && (
    <span className="preference-badge" style={{ margin: 0 }}>
      repeats {recurrenceRule === 'biweekly' ? 'every 2 weeks' : recurrenceRule}
    </span>
  )}
</div>
            {/* Notes - styled as personal message, collapsible if long */}
            {notes && (
  <div className="card-notes-wrapper">
    <p
      ref={notesRef}
      className={`card-notes${!notesExpanded ? ' card-notes-collapsed' : ''}`}
      style={{ whiteSpace: 'pre-line', cursor: notesTruncated && !notesExpanded ? 'pointer' : undefined }}
      onClick={notesTruncated && !notesExpanded ? (e) => { e.stopPropagation(); setNotesExpanded(true); } : undefined}
    >
      {renderTextWithLinks(notes)}
    </p>
    {notesTruncated && (
      <button
        className="notes-toggle"
        onClick={(e) => {
          e.stopPropagation();
          setNotesExpanded(!notesExpanded);
        }}
      >
        {notesExpanded ? 'Show less' : 'Show more'}
      </button>
    )}
  </div>
)}
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
            <div className="menu-container" ref={menuRef}>
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

        {/* Footer - Rearranged: poster name on left, button on right */}
        <div className="card-footer" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexDirection: 'row',
        }}>
          {/* Left side: poster name and interested count */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div
              ref={nameRef}
              className="poster-name"
              onClick={handleNameClick}
              onMouseEnter={() => setShowNameTooltip(true)}
              onMouseLeave={() => setShowNameTooltip(false)}
              style={{ 
                cursor: authorAvatarUrl ? 'pointer' : 'default',
                position: 'relative',
              }}
            >
              {name}
              {showNameTooltip && (
                <div className="name-tooltip" style={tooltipStyle}>
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
            {peopleInterested > 0 && (
              <span className="interested-badge" style={{ alignSelf: 'flex-start' }}>
                {peopleInterested} interested
              </span>
            )}
          </div>

          {/* Right side: I'm interested button */}
          {!hideInterestButton && status !== 'closed' && (
            <button className="btn btn-primary" onClick={onImInterested}>
              I'm interested
            </button>
          )}
        </div>
      </div>
    </>
  );
}