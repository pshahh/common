'use client';
import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface ProfileCompletionModalProps {
  userId: string;
  userName: string;
  currentAvatarUrl?: string | null;
  currentDateOfBirth?: string | null;
  onComplete: () => void;
  onSkip: () => void;
}

export default function ProfileCompletionModal({
  userId,
  userName,
  currentAvatarUrl = null,
  currentDateOfBirth = null,
  onComplete,
  onSkip,
}: ProfileCompletionModalProps) {
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(currentAvatarUrl ?? null);
  const [dateOfBirth, setDateOfBirth] = useState(currentDateOfBirth ?? '');
  const [loading, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setAvatarFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setAvatarPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      let avatarUrl = currentAvatarUrl;

      // Upload avatar if selected
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `${userId}/avatar.${fileExt}`;

        // Delete old avatar if exists
        if (currentAvatarUrl) {
          const oldPath = currentAvatarUrl.split('/avatars/')[1];
          if (oldPath) {
            await supabase.storage.from('avatars').remove([oldPath]);
          }
        }

        // Upload new avatar
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, { upsert: true });

        if (uploadError) {
          throw new Error('Failed to upload photo: ' + uploadError.message);
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        avatarUrl = publicUrl;
      }

      // Update profile
      const updateData: { avatar_url?: string; date_of_birth?: string | null } = {};
      
      if (avatarUrl !== currentAvatarUrl) {
        updateData.avatar_url = avatarUrl ?? undefined;
      }
      
      if (dateOfBirth && dateOfBirth !== currentDateOfBirth) {
        updateData.date_of_birth = dateOfBirth;
      }

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', userId);

        if (updateError) {
          throw new Error('Failed to update profile: ' + updateError.message);
        }
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '16px',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '400px',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '24px 24px 0',
          textAlign: 'center',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
            Complete your profile
          </h2>
          <p style={{ fontSize: '14px', color: '#666', lineHeight: 1.5 }}>
            Adding a photo and age helps others know who they're connecting with and builds trust.
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Avatar upload */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '12px' }}>
              Profile photo <span style={{ fontWeight: 400, color: '#888' }}>(optional)</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Avatar preview */}
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: avatarPreview ? `url(${avatarPreview}) center/cover` : '#f0f0f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  border: '2px dashed #e0e0e0',
                  flexShrink: 0,
                  transition: 'border-color 0.15s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#888'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
              >
                {!avatarPreview && (
                  <span style={{ fontSize: '24px', color: '#888', fontWeight: 600 }}>
                    {getInitials(userName)}
                  </span>
                )}
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    background: '#fafafa',
                    border: '1px solid #e0e0e0',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    marginBottom: '4px',
                  }}
                >
                  {avatarPreview ? 'Change photo' : 'Upload photo'}
                </button>
                <p style={{ fontSize: '12px', color: '#888' }}>
                  JPG, PNG up to 5MB
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {/* Date of birth */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
              Date of birth <span style={{ fontWeight: 400, color: '#888' }}>(optional)</span>
            </label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              max={new Date().toISOString().split('T')[0]} // Can't be in the future
              style={{
                padding: '12px 16px',
                border: '1px solid #e0e0e0',
                borderRadius: '12px',
                fontSize: '14px',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
            <p style={{ fontSize: '12px', color: '#888', marginTop: '6px' }}>
              Your age will be shown on your profile, not your birth date
            </p>
          </div>

          {error && (
            <p style={{ color: '#dc2626', fontSize: '14px', marginBottom: '16px' }}>{error}</p>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={handleSave}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 24px',
                background: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '24px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={onSkip}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 24px',
                background: 'transparent',
                color: '#666',
                border: 'none',
                borderRadius: '24px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}