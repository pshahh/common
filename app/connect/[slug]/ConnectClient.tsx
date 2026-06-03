'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import Header from '@/app/components/Header';
import AuthModal from '@/app/components/AuthModal';
import { getAvatarUrl } from '@/lib/profile';
import { useShareInvite } from '@/lib/useShareInvite';
import ShareInviteModal from '@/app/components/ShareInviteModal';

interface ConnectProfile {
  id: string;
  first_name: string;
  avatar_url: string | null;
}

interface ConnectClientProps {
  slug: string;
}

export default function ConnectClient({ slug }: ConnectClientProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [inviter, setInviter] = useState<ConnectProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [alreadyFriends, setAlreadyFriends] = useState(false);
  const [isSelf, setIsSelf] = useState(false);
  const { shareUrl: inviteShareUrl, showModal: showShareModal, handleShareClick: handleShareInvite, closeModal: closeShareModal } = useShareInvite({ userId: user?.id });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [phase, setPhase] = useState<'connect' | 'celebrating' | 'done'>('connect');

  // Auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch current user's name
  useEffect(() => {
    async function fetchCurrentProfile() {
      if (!user) {
        setCurrentUserName(null);
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('first_name')
        .eq('id', user.id)
        .single();
      if (data) setCurrentUserName(data.first_name);
    }
    fetchCurrentProfile();
  }, [user]);

  // Fetch inviter profile
  useEffect(() => {
    async function fetchInviter() {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, avatar_url')
        .eq('connect_slug', slug)
        .single();

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setInviter(data);
      setLoading(false);
    }
    fetchInviter();
  }, [slug]);

  // Check if already friends or self
  useEffect(() => {
    async function checkFriendship() {
      if (!user || !inviter) return;

      if (user.id === inviter.id) {
        setIsSelf(true);
        return;
      }

      const [id1, id2] = [user.id, inviter.id].sort();
      const { data } = await supabase
        .from('friendships')
        .select('id')
        .eq('user_id_1', id1)
        .eq('user_id_2', id2)
        .single();

      if (data) setAlreadyFriends(true);
    }
    checkFriendship();
  }, [user, inviter]);

  // Create friendship
  const createFriendship = useCallback(async () => {
    if (!user || !inviter || connecting) return;
    setConnecting(true);

    const [id1, id2] = [user.id, inviter.id].sort();

    const { error } = await supabase
      .from('friendships')
      .insert({ user_id_1: id1, user_id_2: id2 });

    if (error) {
      // Unique constraint violation means already friends
      if (error.code === '23505') {
        setAlreadyFriends(true);
        setConnecting(false);
        return;
      }
      console.error('Error creating friendship:', error);
      setConnecting(false);
      return;
    }

    // Success — show celebration
    setPhase('celebrating');
  }, [user, inviter, connecting]);

  // Handle the "Be friends" button
  const handleConnect = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    createFriendship();
  };

  // After auth success (login, not signup — signup needs email verification)
  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    // Small delay to let auth state propagate
    setTimeout(() => {
      createFriendship();
    }, 500);
  };

  // Auto-connect when an authenticated user lands on this page
  // and isn't yet friends with the inviter. This handles:
  // 1. User returns after email verification (fresh page load, authenticated)
  // 2. User was already logged in and navigated here
  // We use a ref to ensure we only attempt once per page load.
  const autoConnectAttempted = useRef(false);

  useEffect(() => {
    if (
      user && inviter && !isSelf && !alreadyFriends &&
      !connecting && phase === 'connect' &&
      !autoConnectAttempted.current && !loading
    ) {
      // Check URL for post-verification redirect indicators
      const url = new URL(window.location.href);
      const hasAuthParams = url.hash.includes('access_token') ||
        url.searchParams.has('code') ||
        url.searchParams.has('token_hash');

      if (hasAuthParams) {
        // User just verified their email — auto-connect
        autoConnectAttempted.current = true;
        createFriendship();
      }
    }
  }, [user, inviter, isSelf, alreadyFriends, connecting, phase, loading, createFriendship]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const avatarUrl = inviter?.avatar_url
    ? getAvatarUrl(inviter.avatar_url, process.env.NEXT_PUBLIC_SUPABASE_URL!)
    : null;

  // ─── Loading ───
  if (loading) {
    return (
      <div style={{
        minHeight: '100dvh',
        background: 'var(--bg-subtle)',
        fontFamily: "'Satoshi', 'Inter', system-ui, sans-serif",
      }}>
        <Header onLoginClick={() => {}} user={user} onLogout={handleLogout} />
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: 'calc(100dvh - 56px)',
        }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Loading...</div>
        </div>
      </div>
    );
  }

  // ─── Not found ───
  if (notFound) {
    return (
      <div style={{
        minHeight: '100dvh',
        background: 'var(--bg-subtle)',
        fontFamily: "'Satoshi', 'Inter', system-ui, sans-serif",
      }}>
        <Header onLoginClick={() => {}} user={user} onLogout={handleLogout} />
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: 'calc(100dvh - 56px)',
          textAlign: 'center', padding: '0 32px',
        }}>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
            Invite not found
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
            This link may have expired or is no longer valid.
          </div>
          <button
            onClick={() => router.push('/')}
            style={{
              background: 'var(--accent)', color: 'var(--text-inverse)',
              border: 'none', padding: '12px 24px', borderRadius: '24px',
              fontWeight: 600, fontSize: '14px', cursor: 'pointer',
            }}
          >
            Go to common
          </button>
        </div>
      </div>
    );
  }

  // ─── Celebration screen ───
  if (phase === 'celebrating' && inviter) {
    return (
      <div style={{
        minHeight: '100dvh',
        background: 'var(--bg-subtle)',
        fontFamily: "'Satoshi', 'Inter', system-ui, sans-serif",
        position: 'relative',
        overflow: 'hidden',
      }}>
        <Header onLoginClick={() => {}} user={user} onLogout={handleLogout} />

        {/* Confetti */}
        <CelebrationConfetti />

        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: 'calc(100dvh - 56px)',
          textAlign: 'center', padding: '0 32px',
          position: 'relative', zIndex: 10,
        }}>
          {/* Emoji */}
          <div style={{
            fontSize: '80px', lineHeight: 1, marginBottom: '32px',
            animation: 'emojiPop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.4) forwards',
            opacity: 0, transform: 'scale(0)',
          }}>
            🤝
          </div>

          {/* Text */}
          <div style={{
            fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)',
            lineHeight: 1.3, letterSpacing: '-0.3px',
            marginBottom: '32px', maxWidth: '300px',
            animation: 'fadeUp 0.5s ease-out 0.5s forwards',
            opacity: 0, transform: 'translateY(16px)',
          }}>
            You and {inviter.first_name} are now friends on common
          </div>

          {/* Button */}
          <div style={{
            animation: 'fadeUp 0.5s ease-out 0.9s forwards',
            opacity: 0, transform: 'translateY(12px)',
            width: '100%', maxWidth: '300px',
          }}>
            <button
              onClick={() => router.push('/')}
              style={{
                background: 'var(--accent)', color: 'var(--text-inverse)',
                border: 'none', padding: '16px 32px', borderRadius: '24px',
                fontWeight: 600, fontSize: '16px', cursor: 'pointer',
                width: '100%',
              }}
            >
              Start making plans
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          position: 'fixed', bottom: '32px', left: 0, right: 0,
          textAlign: 'center', zIndex: 10,
        }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            common helps people do more together
          </div>
        </div>

        <style>{`
          @keyframes emojiPop {
            0% { opacity: 0; transform: scale(0); }
            60% { opacity: 1; transform: scale(1.15); }
            100% { opacity: 1; transform: scale(1); }
          }
          @keyframes fadeUp {
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes confettiBurst {
            0% { opacity: 1; transform: translate(0, 0) rotate(0deg) scale(1); }
            25% { opacity: 1; transform: translate(calc(var(--tx) * 0.8), calc(var(--ty) * 0.6)) rotate(calc(var(--spin) * 0.3)) scale(1); }
            50% { opacity: 0.9; transform: translate(var(--tx), var(--ty)) rotate(calc(var(--spin) * 0.6)) scale(0.9); }
            75% { opacity: 0.5; transform: translate(calc(var(--tx) * 0.95), calc(var(--ty) + var(--fall) * 0.4)) rotate(calc(var(--spin) * 0.85)) scale(0.7); }
            100% { opacity: 0; transform: translate(calc(var(--tx) * 0.85), calc(var(--ty) + var(--fall))) rotate(var(--spin)) scale(0.3); }
          }
        `}</style>
      </div>
    );
  }

  // ─── Connect page (main view) ───
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg-subtle)',
      fontFamily: "'Satoshi', 'Inter', system-ui, sans-serif",
      display: 'flex',
      flexDirection: 'column',
    }}>
      <Header
        onLoginClick={() => setShowAuthModal(true)}
        user={user}
        onLogout={handleLogout}
      />

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '48px 28px 32px', textAlign: 'center',
      }}>
        {/* Profile photo */}
        <div style={{
  width: 'min(200px, 40vw)', height: 'min(200px, 40vw)', borderRadius: '50%',
  background: 'var(--bg-badge)', border: '2px solid var(--border)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  marginBottom: '40px', overflow: 'hidden',
  flexShrink: 0,
}}>
          {avatarUrl ? (
            <img
            src={avatarUrl}
            alt={inviter!.first_name}
            width={400}
            height={400}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              background: 'var(--bg-badge)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '44px', fontWeight: 600, color: 'var(--text-secondary)',
            }}>
              {inviter!.first_name[0]}
            </div>
          )}
        </div>

        {/* Headline */}
        <div style={{
  fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 600, color: 'var(--text-primary)',
  lineHeight: 1.3, letterSpacing: '-0.3px',
  marginBottom: '44px', maxWidth: '460px',
}}>
          {inviter!.first_name} wants to make more memories with you
        </div>

        {/* Self link */}
{isSelf && (
  <div style={{
    fontSize: '14px', color: 'var(--text-secondary)',
    lineHeight: 1.6, maxWidth: '280px',
    marginBottom: '36px', textAlign: 'center',
  }}>
    This is your friendship link. Share it with your friends and start making plans together on common.
  </div>
)}

        {/* Already friends */}
        {alreadyFriends && (
          <div style={{
            background: 'var(--bg-badge)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: '16px 20px',
            fontSize: '14px', color: 'var(--text-secondary)',
            marginBottom: '24px', maxWidth: '300px', lineHeight: 1.5,
          }}>
            You and {inviter!.first_name} are already friends on common.
          </div>
        )}

        {/* CTA */}
        {!isSelf && !alreadyFriends && (
          <>
            <button
              onClick={handleConnect}
              disabled={connecting}
              style={{
                background: 'var(--accent)', color: 'var(--text-inverse)',
                border: 'none', padding: '18px 36px', borderRadius: '24px',
                fontWeight: 600, fontSize: '18px', cursor: connecting ? 'not-allowed' : 'pointer',
                width: '100%', maxWidth: '380px',
                marginBottom: '20px',
                opacity: connecting ? 0.7 : 1,
              }}
            >
              {connecting ? 'Connecting...' : 'Be friends'}
            </button>

            {/* Subtext */}
            <div style={{
  fontSize: '16px', color: '#666',
  lineHeight: 1.6, maxWidth: '380px',
}}>
              Become friends on common to see what {inviter!.first_name}'s up to and get involved. They'll see your plans too.
            </div>
          </>
        )}

        {/* Already friends — go to feed */}
        {alreadyFriends && (
          <button
            onClick={() => router.push('/')}
            style={{
              background: 'var(--accent)', color: 'var(--text-inverse)',
              border: 'none', padding: '16px 32px', borderRadius: '24px',
              fontWeight: 600, fontSize: '16px', cursor: 'pointer',
              width: '100%', maxWidth: '300px',
            }}
          >
            Start making plans
          </button>
        )}

        {/* Self — share friendship link */}
{isSelf && (
          <button
            onClick={handleShareInvite}
            style={{
              background: 'var(--accent)', color: 'var(--text-inverse)',
              border: 'none', padding: '16px 32px', borderRadius: '24px',
              fontWeight: 600, fontSize: '16px', cursor: 'pointer',
              width: '100%', maxWidth: '300px',
            }}
          >
            Share friendship link
          </button>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '16px 28px 36px', textAlign: 'center' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          common helps people do more together
        </div>
      </div>

      <ShareInviteModal
        isOpen={showShareModal}
        onClose={closeShareModal}
        userName={inviter?.first_name || ''}
        avatarUrl={avatarUrl}
        shareUrl={inviteShareUrl || ''}
      />

      {/* Auth modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}

// ─── Confetti component ───
function CelebrationConfetti() {
  const colors = [
    '#0F4415', '#2D7A35', '#4CAF50', '#66BB6A', '#81C784',
    '#A5D6A7', '#D4C5A0', '#C8B88A', '#E8DCC8', '#E5DFD8',
    '#B8A97E', '#F0E6C8',
  ];
  const shapes = ['circle', 'rect', 'rect', 'circle', 'rect'];
  const particles: Array<{
    id: number; angle: number; distance: number; delay: number;
    size: number; color: string; shape: string; spin: number; duration: number;
  }> = [];

  for (let i = 0; i < 90; i++) {
    const angle = (i / 90) * 360 + (Math.random() * 15 - 7.5);
    particles.push({
      id: i, angle,
      distance: 60 + Math.random() * 200,
      delay: Math.random() * 0.35,
      size: 4 + Math.random() * 10,
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      spin: Math.random() * 900 - 450,
      duration: 2.5 + Math.random() * 1.5,
    });
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, overflow: 'hidden',
      pointerEvents: 'none', zIndex: 5,
    }}>
      {particles.map(p => {
        const rad = (p.angle * Math.PI) / 180;
        const tx = Math.cos(rad) * p.distance;
        const ty = Math.sin(rad) * p.distance;
        const fallY = 350 + Math.random() * 400;

        return (
          <div
            key={p.id}
            style={{
              position: 'absolute', left: '50%', top: '40%',
              width: p.shape === 'circle' ? p.size : p.size * 0.5,
              height: p.shape === 'circle' ? p.size : p.size * 1.3,
              marginLeft: -p.size / 2, marginTop: -p.size / 2,
              background: p.color,
              borderRadius: p.shape === 'circle' ? '50%' : '2px',
              opacity: 0, pointerEvents: 'none',
              animation: `confettiBurst ${p.duration}s cubic-bezier(0.22, 0.61, 0.36, 1) ${p.delay}s forwards`,
              '--tx': `${tx}px`,
              '--ty': `${ty}px`,
              '--fall': `${fallY}px`,
              '--spin': `${p.spin}deg`,
            } as React.CSSProperties}
          />
        );
      })}
    </div>
  );
}