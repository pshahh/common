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

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // On iOS, show our custom prompt (no beforeinstallprompt event)
    if (isIOSDevice) {
      // Delay showing to not overwhelm on first visit
      const timer = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(timer);
    }

    // On Android/Chrome, capture the install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      const timer = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(timer);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
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
          <p style={{
            fontSize: '13px',
            color: '#999',
            margin: 0,
            lineHeight: 1.4,
          }}>
            {isIOS
              ? 'Tap the share button, then "Add to Home Screen"'
              : 'Get notifications when someone messages you'
            }
          </p>
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