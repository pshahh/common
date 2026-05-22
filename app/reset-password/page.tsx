'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      background: '#FEFCF8',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
      }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', textAlign: 'center' }}>
          Set a new password
        </h1>
        {success ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.5 }}>
              Your password has been updated. You can now log in with your new password.
            </p>
            <button
              onClick={() => router.push('/')}
              style={{
                background: '#0F4415',
                color: '#FEFCF8',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '24px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Go to common
            </button>
          </div>
        ) : (
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (password.length < 6) {
              setError('Password must be at least 6 characters');
              return;
            }
            setLoading(true);
            setError(null);
            const { error } = await supabase.auth.updateUser({ password });
            if (error) {
              setError(error.message);
              setLoading(false);
            } else {
              setSuccess(true);
              setLoading(false);
            }
          }}>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.5, textAlign: 'center' }}>
              Enter your new password below.
            </p>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>
                New password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: 'var(--border)',
                  borderRadius: '12px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            {error && (
              <p style={{ color: '#DC2626', fontSize: '14px', marginBottom: '16px' }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: '#0F4415',
                color: '#FEFCF8',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '24px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Please wait...' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
