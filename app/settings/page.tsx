'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import { calculateAge } from '@/lib/profile';

interface Profile {
  id: string;
  first_name: string;
  avatar_url: string | null;
  date_of_birth: string | null;
  email_notifications: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingPostsCount, setPendingPostsCount] = useState(0);
  const [pendingReportsCount, setPendingReportsCount] = useState(0);
  const [mobileTab, setMobileTab] = useState<'home' | 'messages' | 'activity' | 'menu'>('menu');

  // Form state
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [firstName, setFirstName] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordSent, setPasswordSent] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check screen size
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Check auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        router.push('/');
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        router.push('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  // Check if user is admin and fetch counts
  useEffect(() => {
    async function checkAdmin() {
      if (!user) return;
      
      const { data: profileData } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();
      
      if (profileData?.is_admin) {
        setIsAdmin(true);
        
        // Fetch pending counts
        const [postsRes, reportsRes] = await Promise.all([
          supabase.from('posts').select('id', { count: 'exact' }).eq('status', 'pending'),
          supabase.from('reports').select('id', { count: 'exact' }).eq('status', 'pending'),
        ]);
        
        setPendingPostsCount(postsRes.count || 0);
        setPendingReportsCount(reportsRes.count || 0);
      }
    }
    
    checkAdmin();
  }, [user]);

  // Fetch profile
  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

        if (!error && data) {
          setProfile(data);
          setAvatarPreview(data.avatar_url);
          setDateOfBirth(data.date_of_birth || '');
          setEmailNotifications(data.email_notifications !== false);
          setFirstName(data.first_name || '');
        }
      setLoading(false);
    }

    if (user) {
      fetchProfile();
    }
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setAvatarFile(file);
    setError(null);
    setSaveSuccess(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      setAvatarPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    if (!user || !profile) return;

    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      let avatarUrl = profile.avatar_url;

      // Upload avatar if changed
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `${user.id}/avatar.${fileExt}`;

        // Delete old avatar if exists
        if (profile.avatar_url) {
          const oldPath = profile.avatar_url.split('/avatars/')[1];
          if (oldPath) {
            await supabase.storage.from('avatars').remove([oldPath]);
          }
        }

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, { upsert: true });

        if (uploadError) {
          throw new Error('Failed to upload photo: ' + uploadError.message);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        avatarUrl = publicUrl;
      }

      
      // Validate name
if (!firstName.trim()) {
  throw new Error('First name is required');
}
// Update profile
const { error: updateError } = await supabase
  .from('profiles')
  .update({
    first_name: firstName.trim(),
    avatar_url: avatarUrl,
    date_of_birth: dateOfBirth || null,
    email_notifications: emailNotifications,
  })
  .eq('id', user.id);

      if (updateError) {
        throw new Error('Failed to update profile: ' + updateError.message);
      }

      setProfile({ 
        ...profile, 
        first_name: firstName.trim(),
        avatar_url: avatarUrl, 
        date_of_birth: dateOfBirth || null,
        email_notifications: emailNotifications,
      });
      setAvatarFile(null);
      setSaveSuccess(true);

      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;

    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/settings`,
    });

    if (error) {
      setError('Failed to send password reset email');
    } else {
      setPasswordSent(true);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE' || !user) return;

    setDeleting(true);

    try {
      // Delete user's posts
      await supabase.from('posts').delete().eq('user_id', user.id);

      // Delete user's profile (will cascade or be handled by FK)
      await supabase.from('profiles').delete().eq('id', user.id);

      // Delete avatar from storage
      if (profile?.avatar_url) {
        const avatarPath = profile.avatar_url.split('/avatars/')[1];
        if (avatarPath) {
          await supabase.storage.from('avatars').remove([avatarPath]);
        }
      }

      // Sign out
      await supabase.auth.signOut();

      router.push('/');

    } catch (err) {
      setError('Failed to delete account. Please try again.');
      setDeleting(false);
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

  // Handle mobile tab change
  const handleMobileTabChange = (tab: 'home' | 'messages' | 'activity' | 'menu') => {
    setMobileTab(tab);
    if (tab === 'home') {
      router.push('/');
    } else if (tab === 'messages') {
      router.push('/?messages=open');
    } else if (tab === 'activity') {
      router.push('/my-activity');
    }
    // 'menu' stays or opens overlay (handled by BottomNav)
  };

  if (!user || loading) {
    return null;
  }

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <Header
        onLoginClick={() => {}}
        user={user}
        onLogout={handleLogout}
      />

      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'row',
        overflow: 'hidden',
      }}>
        {/* Sidebar - Hidden on mobile */}
        {!isMobile && (
          <div style={{
            width: '224px',
            flexShrink: 0,
            borderRight: '1px solid #f0f0f0',
            background: 'rgba(250, 250, 250, 0.5)',
            overflow: 'hidden',
          }}>
            <Sidebar
              userId={user.id}
              selectedThreadId={null}
              onSelectThread={(threadId) => router.push(`/?thread=${threadId}`)}
              onNavigateToMyActivity={() => router.push('/my-activity')}
              onLogout={handleLogout}
              activeItem="settings"
            />
          </div>
        )}

        {/* Main content */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto',
          paddingBottom: isMobile ? '80px' : '0',
        }}>
          <div style={{ 
            maxWidth: '500px', 
            width: '100%', 
            margin: '0 auto', 
            padding: isMobile ? '16px' : '24px',
          }}>
            <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '32px' }}>
              Settings
            </h1>

            {/* Profile Section */}
            <section style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px', color: '#000' }}>
                Profile
              </h2>

              {/* First name */}
<div style={{ marginBottom: '24px' }}>
  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
    First name
  </label>
  <input
    type="text"
    value={firstName}
    onChange={(e) => {
      setFirstName(e.target.value);
      setSaveSuccess(false);
    }}
    style={{
      padding: '12px 16px',
      border: '1px solid #e0e0e0',
      borderRadius: '12px',
      fontSize: '14px',
      outline: 'none',
      width: '100%',
      maxWidth: '300px',
    }}
  />
</div>

              {/* Avatar */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '12px' }}>
                  Profile photo
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
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
                      border: '2px solid #e0e0e0',
                      flexShrink: 0,
                    }}
                  >
                    {!avatarPreview && (
                      <span style={{ fontSize: '24px', color: '#888', fontWeight: 600 }}>
                        {profile ? getInitials(profile.first_name) : '?'}
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
                      }}
                    >
                      {avatarPreview ? 'Change photo' : 'Upload photo'}
                    </button>
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
                  Date of birth
                </label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => {
                    setDateOfBirth(e.target.value);
                    setSaveSuccess(false);
                  }}
                  max={new Date().toISOString().split('T')[0]}
                  style={{
                    padding: '12px 16px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '12px',
                    fontSize: '14px',
                    outline: 'none',
                    width: '100%',
                    maxWidth: '200px',
                  }}
                />
                {dateOfBirth && (
                  <p style={{ fontSize: '13px', color: '#666', marginTop: '6px' }}>
                    Shown as: {profile?.first_name}, {calculateAge(dateOfBirth)}
                  </p>
                )}
              </div>
            </section>

            {/* Notifications Section */}
            <section style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px', color: '#000' }}>
                Notifications
              </h2>

              {/* Email notifications toggle */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '16px 0',
              }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
                    Email notifications
                  </label>
                  <p style={{ fontSize: '13px', color: '#666', margin: 0 }}>
                    Get notified when you receive a new message
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEmailNotifications(!emailNotifications);
                    setSaveSuccess(false);
                  }}
                  style={{
                    width: '48px',
                    height: '28px',
                    borderRadius: '14px',
                    border: 'none',
                    background: emailNotifications ? '#000' : '#e0e0e0',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background 0.2s ease',
                    flexShrink: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute',
                    top: '2px',
                    left: emailNotifications ? '22px' : '2px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </button>
              </div>
            </section>

            {error && (
              <p style={{ color: '#dc2626', fontSize: '14px', marginBottom: '16px' }}>{error}</p>
            )}

            {saveSuccess && (
              <p style={{ color: '#4a9d6b', fontSize: '14px', marginBottom: '16px' }}>✓ Changes saved</p>
            )}

            <button
              onClick={handleSaveProfile}
              disabled={saving}
              style={{
                padding: '12px 24px',
                background: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '24px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
                marginBottom: '40px',
              }}
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>

            {/* Account Section */}
            <section style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px', color: '#000' }}>
                Account
              </h2>

              {/* Email */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
                  Email
                </label>
                <p style={{ fontSize: '14px', color: '#666' }}>{user.email}</p>
              </div>

              {/* Password */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
                  Password
                </label>
                {!showPasswordChange ? (
                  <button
                    onClick={() => setShowPasswordChange(true)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      fontSize: '14px',
                      color: '#666',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                    }}
                  >
                    Change password
                  </button>
                ) : passwordSent ? (
                  <p style={{ fontSize: '14px', color: '#4a9d6b' }}>
                    ✓ Password reset email sent to {user.email}
                  </p>
                ) : (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={handlePasswordReset}
                      style={{
                        padding: '8px 16px',
                        background: '#fafafa',
                        border: '1px solid #e0e0e0',
                        borderRadius: '20px',
                        fontSize: '14px',
                        cursor: 'pointer',
                      }}
                    >
                      Send reset email
                    </button>
                    <button
                      onClick={() => setShowPasswordChange(false)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        fontSize: '14px',
                        color: '#888',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Delete Account */}
              <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #e0e0e0' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
                  Delete account
                </label>
                <p style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
                  Permanently delete your account and all associated data.
                </p>
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    style={{
                      padding: '12px 24px',
                      background: '#fff',
                      color: '#444',
                      border: '1px solid #e0e0e0',
                      borderRadius: '24px',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Delete account
                  </button>
                ) : (
                  <div style={{
                    padding: '20px',
                    background: '#fafafa',
                    border: '1px solid #e0e0e0',
                    borderRadius: '12px',
                  }}>
                    <p style={{ fontSize: '14px', color: '#444', marginBottom: '16px', lineHeight: 1.5 }}>
                      This will permanently delete your account, posts, and messages. This action cannot be undone.
                    </p>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
                      Type DELETE to confirm
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="DELETE"
                      style={{
                        padding: '12px 16px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '12px',
                        fontSize: '14px',
                        outline: 'none',
                        width: '100%',
                        maxWidth: '200px',
                        marginBottom: '16px',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={deleteConfirmText !== 'DELETE' || deleting}
                        style={{
                          padding: '10px 20px',
                          background: deleteConfirmText === 'DELETE' ? '#000' : '#e0e0e0',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '20px',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: deleteConfirmText === 'DELETE' && !deleting ? 'pointer' : 'not-allowed',
                        }}
                      >
                        {deleting ? 'Deleting...' : 'Delete my account'}
                      </button>
                      <button
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteConfirmText('');
                        }}
                        style={{
                          padding: '10px 20px',
                          background: 'transparent',
                          color: '#666',
                          border: 'none',
                          borderRadius: '20px',
                          fontSize: '14px',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Bottom Nav - Mobile only */}
      {isMobile && (
        <BottomNav
          activeTab={mobileTab}
          onTabChange={handleMobileTabChange}
          onLogout={handleLogout}
          isAdmin={isAdmin}
          pendingPostsCount={pendingPostsCount}
          pendingReportsCount={pendingReportsCount}
        />
      )}
    </div>
  );
}