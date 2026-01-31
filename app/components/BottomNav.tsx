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
  messageCount = 0,
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
    // Don't change tab - stay on current view
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
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          <button
            className={`bottom-nav-item ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => handleNavClick('home')}
          >
            <span className="bottom-nav-icon">🏠</span>
            <span>Home</span>
          </button>

          <button
            className={`bottom-nav-item ${activeTab === 'messages' ? 'active' : ''}`}
            onClick={() => onTabChange('messages')}
          >
            <span className="bottom-nav-icon">💬</span>
            <span>Messages</span>
            {messageCount > 0 && (
              <span className="bottom-nav-badge">{messageCount > 9 ? '9+' : messageCount}</span>
            )}
          </button>

          <button
            className={`bottom-nav-item ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => handleNavClick('activity')}
          >
            <span className="bottom-nav-icon">📋</span>
            <span>Activity</span>
          </button>

          <button
            className={`bottom-nav-item ${activeTab === 'menu' ? 'active' : ''}`}
            onClick={handleMenuClick}
          >
            <span className="bottom-nav-icon">☰</span>
            <span>More</span>
            {isAdmin && (pendingPostsCount > 0 || pendingReportsCount > 0) && (
              <span className="bottom-nav-badge">
                {pendingPostsCount + pendingReportsCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Menu Overlay */}
      {showMenu && (
        <div 
          className="mobile-menu-overlay open"
          onClick={handleCloseMenu}
        >
          <div 
            className="mobile-menu"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="mobile-menu-item"
              onClick={() => {
                router.push('/settings');
                handleCloseMenu();
              }}
            >
              <span className="mobile-menu-icon">⚙️</span>
              Settings
            </button>

            {isAdmin && (
              <>
                <button
                  className="mobile-menu-item"
                  onClick={() => {
                    router.push('/admin/posts');
                    handleCloseMenu();
                  }}
                >
                  <span className="mobile-menu-icon">✓</span>
                  Post approval
                  {pendingPostsCount > 0 && (
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#D4594F',
                      background: '#FBEEED',
                      padding: '2px 8px',
                      borderRadius: '10px',
                    }}>
                      {pendingPostsCount}
                    </span>
                  )}
                </button>

                <button
                  className="mobile-menu-item"
                  onClick={() => {
                    router.push('/admin/reports');
                    handleCloseMenu();
                  }}
                >
                  <span className="mobile-menu-icon">⚠️</span>
                  Reports
                  {pendingReportsCount > 0 && (
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#D4594F',
                      background: '#FBEEED',
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
              className="mobile-menu-item"
              onClick={() => {
                router.push('/guidelines');
                handleCloseMenu();
              }}
            >
              <span className="mobile-menu-icon">📖</span>
              Community guidelines
            </button>

            <button
              className="mobile-menu-item danger"
              onClick={() => {
                onLogout();
                handleCloseMenu();
              }}
            >
              <span className="mobile-menu-icon">🚪</span>
              Log out
            </button>
          </div>
        </div>
      )}
    </>
  );
}