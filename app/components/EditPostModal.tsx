'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Post {
  id: string;
  title: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  time: string;
  notes: string | null;
  preference: string | null;
  expires_at: string | null;
}

interface EditPostModalProps {
  post: Post;
  onClose: () => void;
  onSuccess: () => void;
}

interface LocationSuggestion {
  display_name: string;
  lat: string;
  lon: string;
}

export default function EditPostModal({ post, onClose, onSuccess }: EditPostModalProps) {
  const [title, setTitle] = useState(post.title);
  const [location, setLocation] = useState(post.location);
  const [latitude, setLatitude] = useState<number | null>(post.latitude);
  const [longitude, setLongitude] = useState<number | null>(post.longitude);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [time, setTime] = useState(post.time);
  const [notes, setNotes] = useState(post.notes || '');
  const [preference, setPreference] = useState(post.preference || 'anyone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);

  // Debounced location search
  const searchLocation = useCallback(async (query: string) => {
    if (query.length < 3) {
      setLocationSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setSearchingLocation(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=8&addressdetails=1&extratags=1`
      );
      const data = await response.json();
      setLocationSuggestions(data);
      setShowSuggestions(true);
    } catch (err) {
      console.error('Location search failed:', err);
    }
    setSearchingLocation(false);
  }, []);

  const handleLocationChange = (value: string) => {
    setLocation(value);
    setLatitude(null);
    setLongitude(null);
    setLocationError(false);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      searchLocation(value);
    }, 300);
  };

  const selectLocation = (suggestion: LocationSuggestion) => {
    const shortName = suggestion.display_name.split(',').slice(0, 4).join(',');
    setLocation(shortName);
    setLatitude(parseFloat(suggestion.lat));
    setLongitude(parseFloat(suggestion.lon));
    setShowSuggestions(false);
    setLocationSuggestions([]);
    setLocationError(false);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (locationInputRef.current && !locationInputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Only require coordinates if location was changed
    const locationChanged = location !== post.location;
    if (locationChanged && (!latitude || !longitude)) {
      setLocationError(true);
      return;
    }
    
    setLoading(true);
    setError(null);

    // Build update object - only include coordinates if we have them
    const updateData: Record<string, unknown> = {
      title,
      location,
      time,
      notes: notes || null,
      preference,
    };
    
    // Only update coordinates if they exist (location was changed and selected from dropdown)
    if (latitude && longitude) {
      updateData.latitude = latitude;
      updateData.longitude = longitude;
    }

    const { error: updateError } = await supabase
      .from('posts')
      .update(updateData)
      .eq('id', post.id);

    if (updateError) {
      console.error('Update error:', updateError);
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    setShowConfirmation(true);
  };

  // Confirmation screen
  if (showConfirmation) {
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
        }}
        onClick={onSuccess}
      >
        <div 
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '400px',
            padding: '40px 32px',
            textAlign: 'center',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: '#edf7f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: '#4a9d6b',
            fontSize: '20px',
          }}>
            ✓
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
            Changes saved
          </h2>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '24px' }}>
            Your post has been updated.
          </p>
          <button
            onClick={onSuccess}
            style={{
              background: '#000',
              color: '#fff',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '24px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

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
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          backgroundColor: '#FFFFFF',
          borderRadius: '16px 16px 0 0',
          zIndex: 10
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
            Edit post
          </h2>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#888',
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
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '12px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Where */}
            <div style={{ position: 'relative' }} ref={locationInputRef}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
                Where?
              </label>
              <p style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
                This helps people find it
              </p>
              <input
                type="text"
                value={location}
                onChange={e => handleLocationChange(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: `1px solid ${locationError ? '#dc2626' : '#e0e0e0'}`,
                  borderRadius: '12px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {showSuggestions && locationSuggestions.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #e0e0e0',
                  borderRadius: '12px',
                  marginTop: '4px',
                  zIndex: 10,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  overflow: 'hidden',
                  maxHeight: '200px',
                  overflowY: 'auto',
                }}>
                  {locationSuggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      onClick={() => selectLocation(suggestion)}
                      style={{
                        padding: '12px 16px',
                        cursor: 'pointer',
                        borderBottom: index < locationSuggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
                        fontSize: '14px',
                        color: '#666',
                      }}
                      onMouseEnter={e => (e.target as HTMLDivElement).style.backgroundColor = '#fafafa'}
                      onMouseLeave={e => (e.target as HTMLDivElement).style.backgroundColor = '#FFFFFF'}
                    >
                      {suggestion.display_name}
                    </div>
                  ))}
                </div>
              )}
              {searchingLocation && (
                <p style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                  Searching...
                </p>
              )}
              {latitude && longitude && (
                <p style={{ fontSize: '12px', color: '#4a9d6b', marginTop: '4px' }}>
                  ✓ Location selected
                </p>
              )}
              {locationError && (
                <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>
                  Please select a location from the suggestions
                </p>
              )}
            </div>

            {/* When */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
                When?
              </label>
              <input
                type="text"
                value={time}
                onChange={e => setTime(e.target.value)}
                placeholder="e.g. weekday evenings, tomorrow at 7pm"
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '12px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Who can respond */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '12px' }}>
                Who can respond?
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['anyone', 'men preferred', 'women preferred'].map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setPreference(option)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '20px',
                      border: 'none',
                      fontSize: '14px',
                      cursor: 'pointer',
                      backgroundColor: preference === option ? '#000' : '#fafafa',
                      color: preference === option ? '#fff' : '#666',
                      textTransform: 'capitalize',
                    }}
                  >
                    {option === 'anyone' ? 'Anyone' : option.charAt(0).toUpperCase() + option.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
                Notes <span style={{ fontWeight: 400, color: '#888' }}>(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Anything helpful to know?"
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '12px',
                  fontSize: '14px',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {error && (
              <p style={{ color: '#DC2626', fontSize: '14px', margin: 0 }}>{error}</p>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            backgroundColor: '#fafafa',
            borderRadius: '0 0 16px 16px',
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: 500,
                border: '1px solid #e0e0e0',
                borderRadius: '24px',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: 600,
                border: 'none',
                borderRadius: '24px',
                background: '#000',
                color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}