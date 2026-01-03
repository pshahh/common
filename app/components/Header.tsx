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
    <header className="header">
      <a href="/" className="logo">common</a>
      <div className="header-right">
        {user ? (
          <div className="user-info">
            {firstName && <span className="user-name">{firstName}</span>}
            <button onClick={onLogout} className="text-link">
              Log out
            </button>
          </div>
        ) : (
          <button onClick={onLoginClick} className="text-link">
            Log in / Sign up
          </button>
        )}
      </div>
    </header>
  );
}