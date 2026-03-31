'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'check-email' | 'forgot-password' | 'reset-sent'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      onSuccess();
      onClose();
      resetForm();
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate name
    if (!firstName.trim()) {
      setError('Please enter your first name');
      return;
    }
    
    setLoading(true);
    setError(null);
  
    // Create the user
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.href.includes('/post/')
  ? `${window.location.href.split('?')[0]}?action=interested`
  : window.location.href,
      },
    });
    
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }
    
    // Create their profile
    if (data.user) {
      const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: data.user.id,
        first_name: firstName.trim(),
      });
    
    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Don't silently fail - this is important
      setError('Account created but profile setup failed. Please contact support.');
    }
      
      if (profileError) {
        // Profile creation failed, but user might still be created
        console.error('Profile creation error:', profileError);
      }
    }
    
    setLoading(false);
    // Show check email screen
    setMode('check-email');
  };

  

const handleForgotPassword = async (e: React.FormEvent) => {
  e.preventDefault();
  setHasSubmitted(true);
  const trimmed = email.trim();
  if (!trimmed) {
    setError('Please enter your email address.');
    return;
  }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setError(null);
  
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
  
      if (!res.ok) {
        setError('Something went wrong. Please try again.');
        setLoading(false);
        return;
      }
  
      setLoading(false);
      setMode('reset-sent');
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setFirstName('');
    setError(null);
    setMode('login');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Forgot password form
if (mode === 'forgot-password') {
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
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '400px',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Reset password</h2>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              color: '#999',
              cursor: 'pointer',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>
        <form onSubmit={handleForgotPassword}>
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '14px', color: '#666', margin: 0, lineHeight: 1.5 }}>
              Enter your email and we'll send you a link to reset your password.
            </p>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>
                Email
              </label>
              <input
  type="text"
  value={email}
  onChange={e => setEmail(e.target.value)}
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
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                marginTop: '8px',
                background: '#000',
                color: '#fff',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '24px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Please wait...' : 'Send reset link'}
            </button>
          </div>
        </form>
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e0e0e0',
          textAlign: 'center',
          backgroundColor: '#fafafa',
        }}>
          <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); }}
              style={{
                background: 'none',
                border: 'none',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#666',
              }}
            >
              Back to log in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// Reset email sent confirmation
if (mode === 'reset-sent') {
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
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '400px',
          overflow: 'hidden',
          textAlign: 'center',
          padding: '40px 32px',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: '#f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          fontSize: '24px',
        }}>
          ✉
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
          Check your email
        </h2>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '8px', lineHeight: 1.5 }}>
          We've sent a password reset link to:
        </p>
        <p style={{ fontSize: '14px', fontWeight: 500, marginBottom: '16px' }}>
          {email}
        </p>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '24px', lineHeight: 1.5 }}>
          Click the link in the email to set a new password.
        </p>
        <button
          onClick={handleClose}
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
          Got it
        </button>
      </div>
    </div>
  );
}

  // Check email confirmation screen
  if (mode === 'check-email') {
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
        onClick={handleClose}
      >
        <div 
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '400px',
            overflow: 'hidden',
            textAlign: 'center',
            padding: '40px 32px',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Email icon */}
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: '#f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: '24px',
          }}>
            ✉
          </div>
          
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
            Check your email
          </h2>
          
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '8px', lineHeight: 1.5 }}>
            We've sent a confirmation link to:
          </p>
          
          <p style={{ fontSize: '14px', fontWeight: 500, marginBottom: '16px' }}>
            {email}
          </p>
          
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '24px', lineHeight: 1.5 }}>
            Click the link in the email to activate your account, then come back here to log in.
          </p>
          
          <button
            onClick={handleClose}
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
            Got it
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
      }}
      onClick={handleClose}
    >
      <div 
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '400px',
          overflow: 'hidden',
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
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
            {mode === 'login' ? 'Log in' : 'Create account'}
          </h2>
          <button 
            onClick={handleClose}
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
        <form onSubmit={mode === 'login' ? handleLogin : handleSignup}>
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
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
            
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>
                Password
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
                  border: '1px solid #e0e0e0',
                  borderRadius: '12px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            
            {mode === 'signup' && (
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>
                  First name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
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
            )}

{mode === 'login' && (
  <button
    type="button"
    onClick={() => { setMode('forgot-password'); setError(null); }}
    style={{
      background: 'none',
      border: 'none',
      fontSize: '13px',
      color: '#666',
      cursor: 'pointer',
      textDecoration: 'underline',
      padding: 0,
      alignSelf: 'flex-start',
    }}
  >
    Forgot password?
  </button>
)}
            
            {error && (
              <p style={{ color: '#DC2626', fontSize: '14px', margin: 0 }}>{error}</p>
            )}
            
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                marginTop: '8px',
                background: '#000',
                color: '#fff',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '24px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Please wait...' : (mode === 'login' ? 'Log in' : 'Create account')}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e0e0e0',
          textAlign: 'center',
          backgroundColor: '#fafafa',
        }}>
          <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
            {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#666',
              }}
            >
              {mode === 'login' ? 'Create one' : 'Log in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}