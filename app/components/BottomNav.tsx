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

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '64px',
        background: 'var(--bg-subtle)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 50,
      }}>
        {/* Home */}
        <button
          onClick={() => handleNavClick('home')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            padding: '8px 16px',
            cursor: 'pointer',
            minWidth: '64px',
          }}
        >
          <span style={{
            fontSize: '14px',
            fontWeight: activeTab === 'home' ? 600 : 400,
            color: activeTab === 'home' ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}>
            Home
          </span>
        </button>

        {/* Messages */}
        <button
          onClick={() => onTabChange('messages')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            padding: '8px 16px',
            cursor: 'pointer',
            minWidth: '64px',
          }}
        >
          <span style={{
            fontSize: '14px',
            fontWeight: activeTab === 'messages' ? 600 : 400,
            color: activeTab === 'messages' ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}>
            Chats
          </span>
        </button>

        {/* Activity */}
        <button
          onClick={() => handleNavClick('activity')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            padding: '8px 16px',
            cursor: 'pointer',
            minWidth: '64px',
          }}
        >
          <span style={{
            fontSize: '14px',
            fontWeight: activeTab === 'activity' ? 600 : 400,
            color: activeTab === 'activity' ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}>
            Activity
          </span>
        </button>

        {/* More - no badge */}
        <button
          onClick={handleMenuClick}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            padding: '8px 16px',
            cursor: 'pointer',
            minWidth: '64px',
          }}
        >
          <span style={{
            fontSize: '14px',
            fontWeight: activeTab === 'menu' ? 600 : 400,
            color: activeTab === 'menu' ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}>
            More
          </span>
        </button>
      </nav>

      {/* Menu Overlay */}
      {showMenu && (
        <div 
          onClick={handleCloseMenu}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-subtle)',
              borderRadius: '16px 16px 0 0',
              width: '100%',
              maxWidth: '500px',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            {/* Handle bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '12px',
            }}>
              <div style={{
                width: '40px',
                height: '4px',
                background: 'var(--border)',
                borderRadius: '2px',
              }} />
            </div>

            

            {/* Menu items */}
            <div style={{ padding: '0 16px 16px' }}>

            <button
  onClick={() => {
    router.push('/friends');
    handleCloseMenu();
  }}
  style={{
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '16px',
    background: 'none',
    border: 'none',
    borderRadius: '12px',
    fontWeight: 500,
    fontSize: '16px',
    color: 'var(--text-primary)',
    cursor: 'pointer',
  }}
>
  Friends
</button>

              <button
                onClick={() => {
                  router.push('/settings');
                  handleCloseMenu();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  padding: '16px',
                  background: 'none',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  textAlign: 'left',
                }}
              >
                Settings
              </button>

              {isAdmin && (
                <>
                  <button
                    onClick={() => {
                      router.push('/admin/reports');
                      handleCloseMenu();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '16px',
                      background: 'none',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      textAlign: 'left',
                    }}
                  >
                    <span>Reports</span>
                    {pendingReportsCount > 0 && (
                      <span style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#D4594F',
                        background: '#FBEEED',
                        padding: '4px 10px',
                        borderRadius: '12px',
                      }}>
                        {pendingReportsCount}
                      </span>
                    )}
                  </button>
                </>
              )}

              <button
                onClick={() => {
                  router.push('/guidelines');
                  handleCloseMenu();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  padding: '16px',
                  background: 'none',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  textAlign: 'left',
                }}
              >
              Guidelines & examples
              </button>

              <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0' }} />

              <button
  onClick={() => {
    alert('Logout clicked');
    supabase.auth.signOut().then(() => {
      alert('Signed out');
      window.location.href = '/';
    }).catch((err) => {
      alert('Error: ' + err.message);
    });
  }}
  style={{
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '16px',
    background: 'none',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 500,
    color: '#D4594F',
    textAlign: 'left',
  }}
>
  Log out
</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}