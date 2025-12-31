'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface LocationSuggestion {
  display_name: string;
  lat: string;
  lon: string;
}

export default function CreatePostModal({ isOpen, onClose, onSuccess }: CreatePostModalProps) {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [timingMode, setTimingMode] = useState<'specific' | 'flexible'>('specific');
  const [date, setDate] = useState('');
  const [timeDetails, setTimeDetails] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [whoCanRespond, setWhoCanRespond] = useState('anyone');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Search for locations using OpenStreetMap Nominatim
  const searchLocation = async (query: string) => {
    if (query.length < 3) {
      setLocationSuggestions([]);
      return;
    }
  
    setSearchingLocation(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=gb`
      );
      const data = await response.json();
      setLocationSuggestions(data);
      setShowSuggestions(true);
    } catch (err) {
      console.error('Location search failed:', err);
    }
    setSearchingLocation(false);
  };

  const selectLocation = (suggestion: LocationSuggestion) => {
    // Extract a cleaner name (first part before the comma usually)
    const shortName = suggestion.display_name.split(',').slice(0, 2).join(',');
    setLocation(shortName);
    setLatitude(parseFloat(suggestion.lat));
    setLongitude(parseFloat(suggestion.lon));
    setShowSuggestions(false);
    setLocationSuggestions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('You must be logged in to post');
      setLoading(false);
      return;
    }

    // Get user's profile for their name
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', user.id)
      .single();

    // Build the time string
    let timeString = '';
    if (timingMode === 'specific' && date) {
      const dateObj = new Date(date);
      const formatted = dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      timeString = timeDetails ? `${formatted}, ${timeDetails}` : formatted;
    } else {
      timeString = timeDetails || 'Flexible timing';
    }

    // Calculate expiry
    let expiryDate = null;
    if (timingMode === 'specific' && date) {
      // Expire day after the event
      const eventDate = new Date(date);
      eventDate.setDate(eventDate.getDate() + 1);
      expiryDate = eventDate.toISOString();
    } else if (expiresAt) {
      expiryDate = new Date(expiresAt).toISOString();
    }

    const { error: insertError } = await supabase
      .from('posts')
      .insert({
        title,
        location,
        latitude,
        longitude,
        time: timeString,
        notes: notes || null,
        name: profile?.first_name || 'Anonymous',
        preference: whoCanRespond,
        user_id: user.id,
        expires_at: expiryDate,
      });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    // Reset form
    setTitle('');
    setLocation('');
    setLatitude(null);
    setLongitude(null);
    setDate('');
    setTimeDetails('');
    setExpiresAt('');
    setWhoCanRespond('anyone');
    setNotes('');
    
    onSuccess();
    onClose();
  };

  // Set default expiry date (2 weeks from now)
  const defaultExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '16px',
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '500px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          position: 'sticky',
          top: 0,
          backgroundColor: '#FFFFFF',
          borderRadius: '16px 16px 0 0',
          zIndex: 10
        }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>
              Share what you're doing
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Open to company? Let others know
            </p>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* What */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
                What are you doing?
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Going to a gig, tennis, painting in the park, café working..."
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>

            {/* Where */}
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
                Where?
              </label>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                This helps people find it
              </p>
              <input
                type="text"
                value={location}
                onChange={e => {
                  setLocation(e.target.value);
                  setLatitude(null);
                  setLongitude(null);
                  searchLocation(e.target.value);
                }}
                onFocus={() => locationSuggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Start typing to search locations"
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              {showSuggestions && locationSuggestions.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  marginTop: '4px',
                  zIndex: 10,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  overflow: 'hidden',
                }}>
                  {locationSuggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      onClick={() => selectLocation(suggestion)}
                      style={{
                        padding: '12px 16px',
                        cursor: 'pointer',
                        borderBottom: index < locationSuggestions.length - 1 ? '1px solid var(--border-light)' : 'none',
                        fontSize: '14px',
                        color: 'var(--text-secondary)',
                      }}
                      onMouseEnter={e => (e.target as HTMLDivElement).style.backgroundColor = 'var(--background-subtle)'}
                      onMouseLeave={e => (e.target as HTMLDivElement).style.backgroundColor = '#FFFFFF'}
                    >
                      {suggestion.display_name}
                    </div>
                  ))}
                </div>
              )}
              {searchingLocation && (
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  Searching...
                </p>
              )}
              {latitude && longitude && (
                <p style={{ fontSize: '12px', color: 'var(--success)', marginTop: '4px' }}>
                  ✓ Location selected
                </p>
              )}
            </div>

            {/* When */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '12px' }}>
                When will this happen?
              </label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => setTimingMode('specific')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: 'none',
                    fontSize: '14px',
                    cursor: 'pointer',
                    backgroundColor: timingMode === 'specific' ? '#000' : 'var(--background-subtle)',
                    color: timingMode === 'specific' ? '#FFF' : 'var(--text-secondary)',
                  }}
                >
                  On a specific date
                </button>
                <button
                  type="button"
                  onClick={() => setTimingMode('flexible')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: 'none',
                    fontSize: '14px',
                    cursor: 'pointer',
                    backgroundColor: timingMode === 'flexible' ? '#000' : 'var(--background-subtle)',
                    color: timingMode === 'flexible' ? '#FFF' : 'var(--text-secondary)',
                  }}
                >
                  Exact date is flexible
                </button>
              </div>

              {timingMode === 'specific' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    required
                    style={{
                      padding: '12px 16px',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      fontSize: '14px',
                      outline: 'none',
                      width: 'fit-content',
                    }}
                  />
                  <input
                    type="text"
                    value={timeDetails}
                    onChange={e => setTimeDetails(e.target.value)}
                    placeholder="Add timing details (e.g. around 7pm)"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input
                    type="text"
                    value={timeDetails}
                    onChange={e => setTimeDetails(e.target.value)}
                    placeholder="e.g. weekday evenings, weekends"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Post expires:</span>
                      <input
                        type="date"
                        value={expiresAt || defaultExpiry}
                        onChange={e => setExpiresAt(e.target.value)}
                        style={{
                          padding: '12px 16px',
                          border: '1px solid var(--border)',
                          borderRadius: '12px',
                          fontSize: '14px',
                          outline: 'none',
                        }}
                      />
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
                      This controls how long your post stays visible.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Who can respond */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '12px' }}>
                Who can respond?
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['Anyone', 'Men preferred', 'Women preferred'].map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setWhoCanRespond(option.toLowerCase())}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '20px',
                      border: 'none',
                      fontSize: '14px',
                      cursor: 'pointer',
                      backgroundColor: whoCanRespond === option.toLowerCase() ? '#000' : 'var(--background-subtle)',
                      color: whoCanRespond === option.toLowerCase() ? '#FFF' : 'var(--text-secondary)',
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {whoCanRespond !== 'anyone' && (
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
                  This is shown as a preference, not a restriction.
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
                Notes <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(optional but worthwhile)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Anything helpful to know? Relevant links welcome here"
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  fontSize: '14px',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {error && (
              <p style={{ color: '#DC2626', fontSize: '14px' }}>{error}</p>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--background-subtle)',
            borderRadius: '0 0 16px 16px',
          }}>
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', maxWidth: '250px' }}>
              Posts are reviewed before appearing to help keep things safe
            </p>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Sharing...' : 'Share'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}