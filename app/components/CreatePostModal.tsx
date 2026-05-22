'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { generateSlug } from '@/lib/slug';

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
  const [frequency, setFrequency] = useState<'one-off' | 'repeats'>('one-off');
const [recurrenceRule, setRecurrenceRule] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [timingMode, setTimingMode] = useState<'specific' | 'flexible'>('specific');
  const [date, setDate] = useState('');
  const [timeDetails, setTimeDetails] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [threadType, setThreadType] = useState<'1:1' | 'group'>('1:1');
  const [whoCanRespond, setWhoCanRespond] = useState('anyone');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  const locationInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Default expiry date (2 weeks from now)
  const defaultExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  // Default date (tomorrow)
const getTomorrowDate = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
};

  // Reset form state when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setLocation('');
      setLatitude(null);
      setLongitude(null);
      setLocationSuggestions([]);
      setShowSuggestions(false);
      setFrequency('one-off');
setRecurrenceRule('weekly');
      setTimingMode('specific');
      setDate(getTomorrowDate());
      setTimeDetails('');
      setExpiresAt(defaultExpiry); // Set default expiry
      setThreadType('1:1');
      setWhoCanRespond('anyone');
      setNotes('');
      setLoading(false);
      setError(null);
      setLocationError(null);
      setShowConfirmation(false);
    }
  }, [isOpen, defaultExpiry]);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target as Node) &&
        locationInputRef.current &&
        !locationInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced location search
  useEffect(() => {
    if (location.length < 3) {
      setLocationSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Don't search if we already have valid coordinates (user selected from dropdown)
    if (latitude !== null && longitude !== null) {
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingLocation(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=8&addressdetails=1&extratags=1`
        );
        if (!response.ok) {
          throw new Error('Search failed');
        }
        const data = await response.json();
        setLocationSuggestions(data);
        setShowSuggestions(true);
      } catch (err) {
        // Silently fail - user can keep typing or try again
        console.log('Location search failed, will retry on next keystroke');
        setLocationSuggestions([]);
      }
      setSearchingLocation(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [location, latitude, longitude]);

  if (!isOpen) return null;

  const selectLocation = (suggestion: LocationSuggestion) => {
    // Show more of the address - take first 3-4 meaningful parts
    const parts = suggestion.display_name.split(',').map(p => p.trim());
    // Take up to 4 parts but skip very long addresses
    const meaningfulParts = parts.slice(0, 4);
    const shortName = meaningfulParts.join(', ');
    
    setLocation(shortName);
    setLatitude(parseFloat(suggestion.lat));
    setLongitude(parseFloat(suggestion.lon));
    setShowSuggestions(false);
    setLocationSuggestions([]);
    setLocationError(null);
  };

  const handleLocationChange = (value: string) => {
    setLocation(value);
    // Clear coordinates when user types - they must select from dropdown
    setLatitude(null);
    setLongitude(null);
    setLocationError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate location has coordinates
    if (latitude === null || longitude === null) {
      setLocationError('Please select a location from the dropdown suggestions');
      locationInputRef.current?.focus();
      return;
    }

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

    // Calculate expiry - always set a value
let expiryDate: string;
if (timingMode === 'specific' && date) {
  const eventDate = new Date(date);
  eventDate.setDate(eventDate.getDate() + 1);
  expiryDate = eventDate.toISOString();
} else if (frequency === 'repeats') {
  // Recurring + flexible: no real expiry, set far future
  expiryDate = new Date('2099-12-31').toISOString();
} else {
  // Use the expiresAt value, or default if not set
  const expiryValue = expiresAt || defaultExpiry;
  expiryDate = new Date(expiryValue).toISOString();
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
  recurrence_rule: frequency === 'repeats' ? recurrenceRule : null,
  status: 'approved',
  slug: generateSlug(title),
  thread_type: threadType,
});

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    setShowConfirmation(true);
  };

  const handleConfirmationClose = () => {
    setShowConfirmation(false);
    onSuccess();
    onClose();
  };

  // Confirmation modal
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
        onClick={handleConfirmationClose}
      >
        <div 
          style={{
            backgroundColor: 'var(--bg-card)',
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
            backgroundColor: 'var(--bg-badge)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: '20px',
            color: 'var(--accent)',
          }}>
            ✓
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
            You're live
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
            We'll email you when people respond.
          </p>
          <button
            onClick={handleConfirmationClose}
            style={{
              background: 'var(--accent)',
              color: 'var(--text-inverse)',
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
          backgroundColor: 'var(--bg-subtle)',
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
          backgroundColor: 'var(--bg-subtle)',
          borderRadius: '16px 16px 0 0',
          zIndex: 10
        }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>
              Share what you're doing
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
  If it's not a personal invitation to an activity you're also participating in, it doesn't belong on common.{' '}
  <a 
    href="/guidelines" 
    target="_blank" 
    style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}
  >
    Guidelines & examples
  </a>
</p>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
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
  What's the plan?
</label>
<input
  type="text"
  value={title}
  onChange={e => setTitle(e.target.value)}
  placeholder="e.g. pub quiz, morning run, coworking session"
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Where */}
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
                Where?
              </label>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Start typing and pick from the suggestions
              </p>
              <input
                ref={locationInputRef}
                type="text"
                value={location}
                onChange={e => handleLocationChange(e.target.value)}
                onFocus={() => locationSuggestions.length > 0 && setShowSuggestions(true)}
                placeholder="e.g. Notting Hill, Victoria Park"
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: `1px solid ${locationError ? '#dc2626' : 'var(--border)'}`,
                  borderRadius: '12px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              
              {/* Location validation feedback */}
              {latitude !== null && longitude !== null && (
                <p style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '6px' }}>
                  ✓ Got it
                </p>
              )}
              {locationError && (
                <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '6px' }}>
                  {locationError}
                </p>
              )}
              {searchingLocation && (
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  Searching...
                </p>
              )}

              {/* Suggestions dropdown */}
              {showSuggestions && locationSuggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    marginTop: '4px',
                    zIndex: 20,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    overflow: 'hidden',
                    maxHeight: '200px',
                    overflowY: 'auto',
                  }}
                >
                  {locationSuggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      onClick={() => selectLocation(suggestion)}
                      style={{
                        padding: '12px 16px',
                        cursor: 'pointer',
                        borderBottom: index < locationSuggestions.length - 1 ? '1px solid var(--border-light)' : 'none',
                        fontSize: '14px',
                        color: 'var(--text-primary)',
                        backgroundColor: 'var(--bg-card)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-card)')}
                    >
                      {suggestion.display_name}
                    </div>
                  ))}
                </div>
              )}
            </div>

{/* How often */}
<div>
  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '12px' }}>
    Is this a regular thing?
  </label>
  <div style={{ display: 'flex', gap: '8px' }}>
    <button
      type="button"
      onClick={() => setFrequency('one-off')}
      style={{
        padding: '8px 16px',
        borderRadius: '20px',
        border: frequency === 'one-off' ? 'none' : '1px solid var(--border)',
        fontSize: '14px',
        cursor: 'pointer',
        backgroundColor: frequency === 'one-off' ? 'var(--accent)' : 'var(--bg-badge)',
        color: frequency === 'one-off' ? 'var(--text-inverse)' : 'var(--text-primary)',
      }}
    >
      Just this once
    </button>
    <button
      type="button"
      onClick={() => setFrequency('repeats')}
      style={{
        padding: '8px 16px',
        borderRadius: '20px',
        border: frequency === 'repeats' ? 'none' : '1px solid var(--border)',
        fontSize: '14px',
        cursor: 'pointer',
        backgroundColor: frequency === 'repeats' ? 'var(--accent)' : 'var(--bg-badge)',
        color: frequency === 'repeats' ? 'var(--text-inverse)' : 'var(--text-primary)',
      }}
    >
      It repeats
    </button>
  </div>
  {frequency === 'repeats' && (
    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
      {([['weekly', 'Weekly'], ['biweekly', 'Every other week'], ['monthly', 'Monthly']] as const).map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => setRecurrenceRule(value)}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            border: frequency === 'repeats' && recurrenceRule === value ? 'none' : '1px solid var(--border)',
            fontSize: '13px',
            cursor: 'pointer',
            backgroundColor: recurrenceRule === value ? 'var(--accent)' : 'var(--bg-badge)',
            color: recurrenceRule === value ? 'var(--text-inverse)' : 'var(--text-primary)',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )}
</div>

            {/* When */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '12px' }}>
                When?
              </label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setTimingMode('specific');
                    if (!date) setDate(getTomorrowDate());
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: timingMode === 'specific' ? 'none' : '1px solid var(--border)',
                    fontSize: '14px',
                    cursor: 'pointer',
                    backgroundColor: timingMode === 'specific' ? 'var(--accent)' : 'var(--bg-badge)',
                    color: timingMode === 'specific' ? 'var(--text-inverse)' : 'var(--text-primary)',
                  }}
                >
                  Specific date
                </button>
                <button
                  type="button"
                  onClick={() => setTimingMode('flexible')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: timingMode === 'flexible' ? 'none' : '1px solid var(--border)',
                    fontSize: '14px',
                    cursor: 'pointer',
                    backgroundColor: timingMode === 'flexible' ? 'var(--accent)' : 'var(--bg-badge)',
                    color: timingMode === 'flexible' ? 'var(--text-inverse)' : 'var(--text-primary)',
                  }}
                >
                  Date is flexible
                </button>
              </div>
              
              {timingMode === 'specific' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {frequency === 'repeats' && (
  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 4px 0' }}>
    When's the next one?
  </p>
)}
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
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input
                    type="text"
                    value={timeDetails}
                    onChange={e => setTimeDetails(e.target.value)}
                    placeholder="e.g. weekday evenings, Saturday mornings"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  {frequency !== 'repeats' && (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Stays up until</span>
      <input
        type="date"
        value={expiresAt}
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
    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
      Your post disappears after this date.
    </p>
  </div>
)}
                </div>
              )}
            </div>

            {/* Chat type */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
                How should people chat with you?
              </label>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                {threadType === '1:1' 
                  ? 'You\'ll chat with each person separately' 
                  : 'Everyone chats in one group'}
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setThreadType('1:1')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: threadType === '1:1' ? 'none' : '1px solid var(--border)',
                    fontSize: '14px',
                    cursor: 'pointer',
                    backgroundColor: threadType === '1:1' ? 'var(--accent)' : 'var(--bg-badge)',
                    color: threadType === '1:1' ? 'var(--text-inverse)' : 'var(--text-primary)',
                  }}
                >
                  1:1 chats
                </button>
                <button
                  type="button"
                  onClick={() => setThreadType('group')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: threadType === 'group' ? 'none' : '1px solid var(--border)',
                    fontSize: '14px',
                    cursor: 'pointer',
                    backgroundColor: threadType === 'group' ? 'var(--accent)' : 'var(--bg-badge)',
                    color: threadType === 'group' ? 'var(--text-inverse)' : 'var(--text-primary)',
                  }}
                >
                  Group chat
                </button>
              </div>
            </div>
            {/* Who can respond */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '12px' }}>
                Who's this for'?
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
                      border: whoCanRespond === option.toLowerCase() ? '1px solid var(--accent)' : '1px solid var(--border)',
                      fontSize: '14px',
                      cursor: 'pointer',
                      backgroundColor: whoCanRespond === option.toLowerCase() ? 'var(--accent)' : 'var(--bg-badge)',
                      color: whoCanRespond === option.toLowerCase() ? 'var(--text-inverse)' : 'var(--text-primary)',
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {whoCanRespond !== 'anyone' && (
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  Just a preference, not a rule.
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
                Notes
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="What should people know? Add some sauce."
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
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {error && (
              <p style={{ color: 'var(--danger)', fontSize: '14px' }}>{error}</p>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-subtle)',
            borderRadius: '0 0 16px 16px',
          }}>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '250px', lineHeight: 1.5 }}>
              Posts go live straight away.<br />Be a good human.
            </p>
            <button
              type="submit"
              disabled={loading}
              style={{
                background: 'var(--accent)',
                color: 'var(--text-inverse)',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '24px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Posting...' : 'Post it'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}