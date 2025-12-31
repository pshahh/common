'use client';

import Link from 'next/link';

interface HeaderProps {
  isLoggedIn?: boolean;
  onLoginClick?: () => void;
}

export default function Header({ isLoggedIn = false, onLoginClick }: HeaderProps) {
  return (
    <header style={{
      height: '56px',
      borderBottom: '1px solid var(--border)',
      backgroundColor: '#FFFFFF',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 40
    }}>
      <Link 
        href="/"
        style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.5px' }}
      >
        common
      </Link>
      
      {!isLoggedIn && (
        <button 
          onClick={onLoginClick}
          style={{ 
            fontSize: '14px', 
            color: 'var(--text-secondary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          Log in / Sign up
        </button>
      )}
    </header>
  );
}