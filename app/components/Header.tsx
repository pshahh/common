'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface HeaderProps {
  onLoginClick: () => void;
  user: User | null;
  onLogout: () => void;
}

export default function Header({ onLoginClick, user, onLogout }: HeaderProps) {
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('first_name')
          .eq('id', user.id)
          .single();
        if (data && !error) {
          setFirstName(data.first_name);
        }
      } else {
        setFirstName(null);
      }
    }
    fetchProfile();
  }, [user]);

  return (
    <header className="header" style={{
      minHeight: '56px',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 40,
    }}>
      <a 
        href="/" 
        style={{
          fontSize: '20px',
          fontWeight: 700,
          color: 'var(--accent)',
          textDecoration: 'none',
          letterSpacing: '-0.5px',
        }}
      >
        common
      </a>
      <div>
        {user ? (
          // When logged in, just show the name (logout is in sidebar)
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            {firstName}
          </span>
        ) : (
          <button
            onClick={onLoginClick}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '14px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              textDecoration: 'underline',
              textDecorationColor: 'transparent',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.textDecorationColor = 'var(--text-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.textDecorationColor = 'transparent';
            }}
          >
            Log in / Sign up
          </button>
        )}
      </div>
    </header>
  );
}