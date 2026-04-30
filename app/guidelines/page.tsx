'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useUnreadCount } from '@/lib/useUnreadCount';
import { User } from '@supabase/supabase-js';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import Sidebar from '../components/Sidebar';

export default function GuidelinesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingReportsCount, setPendingReportsCount] = useState(0);
  const [mobileTab, setMobileTab] = useState<'home' | 'messages' | 'activity' | 'menu'>('menu');
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);

  // Unread thread count for mobile nav badge
  const { unreadCount: threadCount } = useUnreadCount(user?.id, sidebarRefreshTrigger);

  // Check screen size
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Check if user is admin and fetch counts
  useEffect(() => {
    async function checkAdmin() {
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();
      if (profile?.is_admin) {
        setIsAdmin(true);
        // Fetch pending counts
        const [postsRes, reportsRes] = await Promise.all([
          supabase.from('posts').select('id', { count: 'exact' }).eq('status', 'pending'),
          supabase.from('reports').select('id', { count: 'exact' }).eq('status', 'pending'),
        ]);
        setPendingReportsCount(reportsRes.count || 0);
      }
    }
    checkAdmin();
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  // Handle mobile tab change
  const handleMobileTabChange = (tab: 'home' | 'messages' | 'activity' | 'menu') => {
    setMobileTab(tab);
    if (tab === 'home') {
      router.push('/');
    } else if (tab === 'messages') {
      router.push('/?messages=open');
    } else if (tab === 'activity') {
      router.push('/my-activity');
    }
  };

  return (
    <div style={{ 
      height: '100dvh', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: "'Satoshi', 'Inter', system-ui, sans-serif",
    }}>
      <Header
        onLoginClick={() => {}}
        user={user}
        onLogout={handleLogout}
      />

      {/* Main layout with sidebar */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'row',
        overflow: 'hidden',
      }}>
        {/* Sidebar - Desktop only, logged-in only */}
        {user && !isMobile && (
          <div 
            className="desktop-sidebar"
            style={{
              width: '224px',
              flexShrink: 0,
              borderRight: '1px solid #f0f0f0',
              background: 'rgba(250, 250, 250, 0.5)',
              overflow: 'hidden',
            }}
          >
            <Sidebar
              userId={user.id}
              selectedThreadId={null}
              onSelectThread={(threadId) => {
                router.push(`/?thread=${threadId}`);
              }}
              onNavigateToMyActivity={() => router.push('/my-activity')}
              onLogout={handleLogout}
              activeItem={null}
              refreshTrigger={sidebarRefreshTrigger}
            />
          </div>
        )}

        {/* Guidelines content */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto',
          background: '#FAFAFA',
          padding: isMobile ? '24px 16px 100px' : '48px 24px',
        }}>
          <div style={{ 
            maxWidth: '640px', 
            margin: '0 auto',
            background: '#fff',
            borderRadius: '16px',
            border: '1px solid #E0E0E0',
            padding: isMobile ? '24px' : '48px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
           <h1 style={{ 
  fontSize: isMobile ? '24px' : '28px', 
  fontWeight: 700, 
  color: '#000',
  letterSpacing: '-0.5px',
  marginBottom: '8px',
}}>
  Guidelines & examples
</h1>
<p style={{ 
  fontSize: '14px', 
  color: '#888', 
  marginBottom: '32px',
}}>
  Simple rules to keep common useful for everyone
</p>

{/* The rule */}
<div style={{
  padding: '16px 20px',
  background: '#FAFAFA',
  borderRadius: '12px',
  border: '1px solid #E0E0E0',
  marginBottom: '32px',
}}>
  <p style={{ 
    fontSize: '15px', 
    color: '#000', 
    lineHeight: 1.6,
    margin: 0,
    fontWeight: 500,
  }}>
    If it's not a personal invitation to an activity you're also participating in, it doesn't belong on common.
  </p>
</div>

<div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
  {/* What Common is for */}
  <section>
    <h2 style={{ 
      fontSize: '18px', 
      fontWeight: 600, 
      color: '#000',
      marginBottom: '12px',
    }}>
      What common is for
    </h2>
    <p style={{ 
      fontSize: '14px', 
      color: '#444', 
      lineHeight: 1.7,
      margin: 0,
    }}>
      common helps you find people to do real activities with nearby. The best posts are from someone who's doing something and is genuinely open to others joining them.
    </p>
  </section>

  {/* Examples - two columns */}
  <section>
    <h2 style={{ 
      fontSize: '18px', 
      fontWeight: 600, 
      color: '#000',
      marginBottom: '16px',
    }}>
      Examples
    </h2>
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', 
      gap: '12px',
    }}>
      {/* Column headers */}
      <p style={{ fontSize: '13px', fontWeight: 600, color: '#444', margin: '0 0 4px 0' }}>
        ✓ Belongs on common
      </p>
      <p style={{ fontSize: '13px', fontWeight: 600, color: '#444', margin: '0 0 4px 0' }}>
        ✗ Doesn't belong on common
      </p>

      {/* Pair 1 - casual activity */}
      <div style={{
        padding: '12px 16px',
        background: '#FAFAFA',
        borderRadius: '12px',
        border: '1px solid #E0E0E0',
      }}>
        <p style={{ fontSize: '14px', color: '#000', margin: 0, fontWeight: 500 }}>Going for a run around Highbury Fields</p>
        <p style={{ fontSize: '13px', color: '#888', margin: '4px 0 0 0' }}>Personal activity, open to company</p>
      </div>
      <div style={{
        padding: '12px 16px',
        background: '#FAFAFA',
        borderRadius: '12px',
        border: '1px solid #E0E0E0',
      }}>
        <p style={{ fontSize: '14px', color: '#000', margin: 0, fontWeight: 500 }}>Free yoga classes every Sunday at our studio</p>
        <p style={{ fontSize: '13px', color: '#888', margin: '4px 0 0 0' }}>Business promotion disguised as an activity</p>
      </div>

      {/* Pair 2 - going to an event */}
      <div style={{
        padding: '12px 16px',
        background: '#FAFAFA',
        borderRadius: '12px',
        border: '1px solid #E0E0E0',
      }}>
        <p style={{ fontSize: '14px', color: '#000', margin: 0, fontWeight: 500 }}>Come to this gig with me. Ticket link below.</p>
        <p style={{ fontSize: '13px', color: '#888', margin: '4px 0 0 0' }}>You're going, looking for someone to go with</p>
      </div>
      <div style={{
        padding: '12px 16px',
        background: '#FAFAFA',
        borderRadius: '12px',
        border: '1px solid #E0E0E0',
      }}>
        <p style={{ fontSize: '14px', color: '#000', margin: 0, fontWeight: 500 }}>New music night - buy tickets here</p>
        <p style={{ fontSize: '13px', color: '#888', margin: '4px 0 0 0' }}>Promoting an event, not a personal invitation</p>
      </div>

      {/* Pair 3 - recurring group activity */}
      <div style={{
        padding: '12px 16px',
        background: '#FAFAFA',
        borderRadius: '12px',
        border: '1px solid #E0E0E0',
      }}>
        <p style={{ fontSize: '14px', color: '#000', margin: 0, fontWeight: 500 }}>I run a writers' group at the pub - come write with us</p>
        <p style={{ fontSize: '13px', color: '#888', margin: '4px 0 0 0' }}>You organise it and participate alongside everyone else</p>
      </div>
      <div style={{
        padding: '12px 16px',
        background: '#FAFAFA',
        borderRadius: '12px',
        border: '1px solid #E0E0E0',
      }}>
        <p style={{ fontSize: '14px', color: '#000', margin: 0, fontWeight: 500 }}>We host an arts and crafts night. Info and tickets here</p>
        <p style={{ fontSize: '13px', color: '#888', margin: '4px 0 0 0' }}>Reads like you're only running the event, not participating as an equal</p>
      </div>
    </div>
  </section>

  {/* What's not allowed */}
  <section>
    <h2 style={{ 
      fontSize: '18px', 
      fontWeight: 600, 
      color: '#000',
      marginBottom: '12px',
    }}>
      What's not allowed
    </h2>
    <ul style={{ 
      fontSize: '14px', 
      color: '#444', 
      lineHeight: 1.8,
      margin: 0,
      paddingLeft: '20px',
    }}>
      <li style={{ marginBottom: '8px' }}>Commercial promotions, advertising, or selling things</li>
      <li style={{ marginBottom: '8px' }}>Promoting events or gatherings you're organising but not joining as a participant</li>
      <li style={{ marginBottom: '8px' }}>Dating or romantic meetup requests</li>
      <li style={{ marginBottom: '8px' }}>Vague posts without a clear activity (e.g. "looking for friends")</li>
      <li style={{ marginBottom: '8px' }}>Anything illegal, harmful, or discriminatory</li>
      <li style={{ marginBottom: '8px' }}>Spam or repeated similar posts</li>
      <li>Posts that don't include a time or location</li>
    </ul>
  </section>

  {/* Be a good human */}
  <section>
    <h2 style={{ 
      fontSize: '18px', 
      fontWeight: 600, 
      color: '#000',
      marginBottom: '12px',
    }}>
      Be a good human
    </h2>
    <p style={{ 
      fontSize: '14px', 
      color: '#444', 
      lineHeight: 1.7,
      margin: 0,
    }}>
      When you connect with someone, be respectful and reliable. Show up when you say you will. Meet in public places. If plans change, let the other person know. Remember that everyone on common is a real person looking to do something fun or meaningful.
    </p>
  </section>

  {/* Staying safe */}
  <section>
    <h2 style={{ 
      fontSize: '18px', 
      fontWeight: 600, 
      color: '#000',
      marginBottom: '12px',
    }}>
      Staying safe
    </h2>
    <p style={{ 
      fontSize: '14px', 
      color: '#444', 
      lineHeight: 1.7,
      margin: 0,
    }}>
      Always meet in public places for the first time. Tell a friend where you're going. Trust your instincts — if something feels off, it's okay to leave. You can report any post or conversation that makes you uncomfortable.
    </p>
  </section>
</div>

{/* Footer */}
<div style={{ 
  marginTop: '48px',
  paddingTop: '24px',
  borderTop: '1px solid #E0E0E0',
}}>
  <p style={{ 
    fontSize: '13px', 
    color: '#888', 
    lineHeight: 1.6,
    margin: 0,
  }}>
    Posts that don't follow these guidelines will be removed. If you have questions, reach out to us at <a href="mailto:hello@common-social.com" style={{ color: '#444' }}>hello@common-social.com</a>
  </p>
</div>
          </div>
        </div>
      </div>

      {/* Bottom Nav - Mobile only, and only if user is logged in */}
      {isMobile && user && (
        <BottomNav
          activeTab={mobileTab}
          onTabChange={handleMobileTabChange}
          onLogout={handleLogout}
          isAdmin={isAdmin}
          messageCount={threadCount}
          pendingReportsCount={pendingReportsCount}
        />
      )}
    </div>
  );
}