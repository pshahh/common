'use client';

import { useState } from 'react';

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
}: PostCardProps) {
  const [showNameTooltip, setShowNameTooltip] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Generate Google Maps URL
  const getMapUrl = () => {
    if (latitude && longitude) {
      // If we have coordinates, link directly to them
      return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    }
    // Fallback to searching by location name
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/post/${id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch (err) {
        // User cancelled or share failed, copy to clipboard instead
        navigator.clipboard.writeText(url);
      }
    } else {
      navigator.clipboard.writeText(url);
      // Could add a toast notification here
    }
  };

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
            <span className="meta-separator">·</span>
            <span>{time}</span>
          </div>
          {notes && <p className="card-notes">{notes}</p>}
          {preference && preference !== 'Anyone' && (
            <span className="preference-badge">{preference}</span>
          )}
        </div>
        <div className="card-actions">
          <button className="share-button" onClick={handleShare}>
            Share ↗
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
              <div className="tooltip-avatar"></div>
              <div className="tooltip-info">
                <span className="tooltip-name">{name}</span>
                <span className="tooltip-since">Active since Jan 2025</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}