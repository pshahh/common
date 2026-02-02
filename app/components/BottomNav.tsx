'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface BottomNavProps {
  activeTab: 'home' | 'messages' | 'activity' | 'menu';
  onTabChange: (tab: 'home' | 'messages' | 'activity' | 'menu') => void;
  messageCount?: number;
  onLogout: () => void;
  isAdmin?: boolean;
  pendingPostsCount?: number;
  pendingReportsCount?: number;
}

export default function BottomNav({
  activeTab,
  onTabChange,
  onLogout,
  isAdmin = false,
  pendingPostsCount = 0,
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
    // 'messages' is handled by onTabChange - parent component opens message list
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
        background: '#FFFFFF',
        borderTop: '1px solid #E0E0E0',
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
            color: activeTab === 'home' ? '#000000' : '#888888',
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
            color: activeTab === 'messages' ? '#000000' : '#888888',
          }}>
            Messages
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
            color: activeTab === 'activity' ? '#000000' : '#888888',
          }}>
            Activity
          </span>
        </button>

        {/* More */}
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
            position: 'relative',
            minWidth: '64px',
          }}
        >
          <span style={{
            fontSize: '14px',
            fontWeight: activeTab === 'menu' ? 600 : 400,
            color: activeTab === 'menu' ? '#000000' : '#888888',
          }}>
            More
          </span>
          {isAdmin && (pendingPostsCount > 0 || pendingReportsCount > 0) && (
            <span style={{
              position: 'absolute',
              top: '4px',
              right: '8px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#FFFFFF',
              background: '#D4594F',
              padding: '2px 6px',
              borderRadius: '10px',
              minWidth: '18px',
              textAlign: 'center',
            }}>
              {pendingPostsCount + pendingReportsCount}
            </span>
          )}
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
              background: '#FFFFFF',
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
                background: '#E0E0E0',
                borderRadius: '2px',
              }} />
            </div>

            {/* Menu items */}
            <div style={{ padding: '0 16px 16px' }}>
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
                  color: '#000000',
                  textAlign: 'left',
                }}
              >
                Settings
              </button>

              {isAdmin && (
                <>
                  <button
                    onClick={() => {
                      router.push('/admin/posts');
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
                      color: '#000000',
                      textAlign: 'left',
                    }}
                  >
                    <span>Post approval</span>
                    {pendingPostsCount > 0 && (
                      <span style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#D4594F',
                        background: '#FBEEED',
                        padding: '4px 10px',
                        borderRadius: '12px',
                      }}>
                        {pendingPostsCount}
                      </span>
                    )}
                  </button>

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
                      color: '#000000',
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
                  color: '#000000',
                  textAlign: 'left',
                }}
              >
                Community guidelines
              </button>

              <div style={{ height: '1px', background: '#F0F0F0', margin: '8px 0' }} />

              <button
                onClick={() => {
                  onLogout();
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