'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface BottomNavProps {
  activeTab: 'home' | 'messages' | 'activity' | 'menu';
  onTabChange: (tab: 'home' | 'messages' | 'activity' | 'menu') => void;
  messageCount?: number;
  onLogout: () => void;
  isAdmin?: boolean;
  pendingReportsCount?: number;
}

// Simple SVG icons matching common's calm aesthetic
const HomeIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
    <path d="M9 21V12h6v9" />
  </svg>
);

const ChatsIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" />
  </svg>
);

const ActivityIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 01-3.46 0" />
  </svg>
);

const MoreIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

export default function BottomNav({
  activeTab,
  onTabChange,
  onLogout,
  isAdmin = false,
  messageCount = 0,
  pendingReportsCount = 0,
}: BottomNavProps) {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);

  const handleMenuClick = () => {
    setShowMenu(true);
    onTabChange('menu');
  };

  const handleCloseMenu = () => {
    setShowMenu(false);
  };

  const handleNavClick = (tab: 'home' | 'messages' | 'activity') => {
    onTabChange(tab);
    if (tab === 'activity') {
      router.push('/my-activity');
    } else if (tab === 'home') {
      router.push('/');
    }
  };

  const navItems = [
    {
      id: 'home' as const,
      label: 'Home',
      icon: HomeIcon,
      onClick: () => handleNavClick('home'),
    },
    {
      id: 'messages' as const,
      label: 'Chats',
      icon: ChatsIcon,
      onClick: () => onTabChange('messages'),
      badge: messageCount > 0 ? messageCount : undefined,
    },
    {
      id: 'activity' as const,
      label: 'Activity',
      icon: ActivityIcon,
      onClick: () => handleNavClick('activity'),
    },
    {
      id: 'menu' as const,
      label: 'More',
      icon: MoreIcon,
      onClick: handleMenuClick,
    },
  ];

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '80px',
        background: 'var(--bg-subtle)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 50,
      }}>
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                padding: '10px 16px',
                cursor: 'pointer',
                minWidth: '64px',
                gap: '2px',
                position: 'relative',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                transition: 'color 0.15s ease',
              }}
            >
              <Icon active={isActive} />
              <span style={{
                fontSize: '10px',
                fontWeight: isActive ? 600 : 400,
                letterSpacing: '0.2px',
              }}>
                {item.label}
              </span>
              {item.badge && (
                <span style={{
                  position: 'absolute',
                  top: '2px',
                  right: '10px',
                  minWidth: '16px',
                  height: '16px',
                  background: 'var(--accent)',
                  color: 'white',
                  fontSize: '10px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Mobile Menu Overlay */}
      {showMenu && (
        <div
          onClick={handleCloseMenu}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            zIndex: 60,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'var(--bg)',
              borderRadius: '16px 16px 0 0',
              padding: '24px',
              paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
            }}
          >
            <button
              onClick={() => { router.push('/friends'); handleCloseMenu(); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px 0',
                borderBottom: '1px solid var(--border-light)',
                fontSize: '16px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                borderBottomWidth: '1px',
                borderBottomStyle: 'solid',
                borderBottomColor: 'var(--border-light)',
                width: '100%',
                textAlign: 'left',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ width: '24px', display: 'flex', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
              </span>
              Friends
            </button>

            <button
              onClick={() => { router.push('/settings'); handleCloseMenu(); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px 0',
                borderBottom: '1px solid var(--border-light)',
                fontSize: '16px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                borderBottomWidth: '1px',
                borderBottomStyle: 'solid',
                borderBottomColor: 'var(--border-light)',
                width: '100%',
                textAlign: 'left',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ width: '24px', display: 'flex', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
              </span>
              Settings
            </button>

            <button
              onClick={() => { router.push('/guidelines'); handleCloseMenu(); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px 0',
                borderBottom: '1px solid var(--border-light)',
                fontSize: '16px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                borderBottomWidth: '1px',
                borderBottomStyle: 'solid',
                borderBottomColor: 'var(--border-light)',
                width: '100%',
                textAlign: 'left',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ width: '24px', display: 'flex', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                </svg>
              </span>
              Guidelines
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={() => { router.push('/admin/posts'); handleCloseMenu(); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px 0',
                    borderBottom: '1px solid var(--border-light)',
                    fontSize: '16px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                    borderBottomWidth: '1px',
                    borderBottomStyle: 'solid',
                    borderBottomColor: 'var(--border-light)',
                    width: '100%',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ width: '24px', display: 'flex', justifyContent: 'center' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </span>
                  Manage posts
                </button>

                <button
                  onClick={() => { router.push('/admin/reports'); handleCloseMenu(); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px 0',
                    borderBottom: '1px solid var(--border-light)',
                    fontSize: '16px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                    borderBottomWidth: '1px',
                    borderBottomStyle: 'solid',
                    borderBottomColor: 'var(--border-light)',
                    width: '100%',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ width: '24px', display: 'flex', justifyContent: 'center' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
                    </svg>
                  </span>
                  Reports
                  {pendingReportsCount > 0 && (
                    <span style={{
                      marginLeft: 'auto',
                      background: '#dc2626',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '10px',
                    }}>
                      {pendingReportsCount}
                    </span>
                  )}
                </button>
              </>
            )}

            <button
              onClick={() => { onLogout(); handleCloseMenu(); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px 0',
                fontSize: '16px',
                color: '#dc2626',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                width: '100%',
                textAlign: 'left',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ width: '24px', display: 'flex', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </span>
              Log out
            </button>
          </div>
        </div>
      )}
    </>
  );
}