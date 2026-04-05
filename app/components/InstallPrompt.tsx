'use client';

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Don't show if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Don't show if user previously dismissed
    if (localStorage.getItem('install-prompt-dismissed')) return;

    // Don't show on desktop
    if (window.innerWidth > 768) return;

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Capture the install prompt if available (Android/Chrome)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Always show the banner after 3 seconds on mobile
    const timer = setTimeout(() => setShow(true), 3000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShow(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('install-prompt-dismissed', 'true');
  };

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '72px',
      left: '12px',
      right: '12px',
      background: '#000',
      color: '#fff',
      borderRadius: '16px',
      padding: '16px 20px',
      zIndex: 49,
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
      animation: 'slideUp 0.3s ease',
    }}>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '12px',
      }}>
        <div style={{ flex: 1 }}>
          <p style={{
            fontSize: '14px',
            fontWeight: 600,
            margin: '0 0 4px',
          }}>
            Add common to your home screen
          </p>
          {isIOS ? (
            <p style={{
              fontSize: '13px',
              color: '#999',
              margin: 0,
              lineHeight: 1.4,
            }}>
              Tap the share button, then &quot;Add to Home Screen&quot;
            </p>
          ) : (
            <p style={{
              fontSize: '13px',
              color: '#999',
              margin: 0,
              lineHeight: 1.4,
            }}>
              {deferredPrompt
                ? 'Get notifications when someone messages you'
                : 'Open the browser menu (⋮) and tap "Add to Home Screen"'
              }
            </p>
          )}
        </div>

        <button
          onClick={handleDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: '#666',
            fontSize: '18px',
            cursor: 'pointer',
            padding: '0',
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>

      {!isIOS && deferredPrompt && (
        <button
          onClick={handleInstall}
          style={{
            marginTop: '12px',
            width: '100%',
            padding: '10px',
            background: '#fff',
            color: '#000',
            border: 'none',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Install
        </button>
      )}
    </div>
  );
}