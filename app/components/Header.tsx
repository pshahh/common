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
    <header style={{
      height: '56px',
      background: '#fff',
      borderBottom: '1px solid #e0e0e0',
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
          color: '#000',
          textDecoration: 'none',
          letterSpacing: '-0.5px',
        }}
      >
        common
      </a>
      <div>
        {user ? (
          // When logged in, just show the name (logout is in sidebar)
          <span style={{ fontSize: '14px', color: '#666' }}>
            {firstName}
          </span>
        ) : (
          <button 
            onClick={onLoginClick} 
            style={{
              background: 'none',
              border: 'none',
              fontSize: '14px',
              color: '#666',
              cursor: 'pointer',
              textDecoration: 'underline',
              textDecorationColor: 'transparent',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#000';
              e.currentTarget.style.textDecorationColor = '#666';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#666';
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