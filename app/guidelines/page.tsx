'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';

export default function GuidelinesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingPostsCount, setPendingPostsCount] = useState(0);
  const [pendingReportsCount, setPendingReportsCount] = useState(0);
  const [mobileTab, setMobileTab] = useState<'home' | 'messages' | 'activity' | 'menu'>('menu');

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
        
        setPendingPostsCount(postsRes.count || 0);
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
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      fontFamily: "'Satoshi', 'Inter', system-ui, sans-serif",
    }}>
      <Header
        onLoginClick={() => {}}
        user={user}
        onLogout={handleLogout}
      />

      <div style={{ 
        flex: 1, 
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
            Community guidelines
          </h1>
          <p style={{ 
            fontSize: '14px', 
            color: '#888', 
            marginBottom: '32px',
          }}>
            Simple rules to keep Common helpful for everyone
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* What Common is for */}
            <section>
              <h2 style={{ 
                fontSize: '18px', 
                fontWeight: 600, 
                color: '#000',
                marginBottom: '12px',
              }}>
                What Common is for
              </h2>
              <p style={{ 
                fontSize: '15px', 
                color: '#444', 
                lineHeight: 1.7,
                margin: 0,
              }}>
                Common helps you find people to do real activities with nearby. Post things like going for a walk, playing sports, attending an event, working on a project together, or exploring a new place. The best posts are specific about what, when, and where.
              </p>
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
                fontSize: '15px', 
                color: '#444', 
                lineHeight: 1.8,
                margin: 0,
                paddingLeft: '20px',
              }}>
                <li style={{ marginBottom: '8px' }}>Commercial promotions, advertising, or selling things</li>
                <li style={{ marginBottom: '8px' }}>Dating or romantic meetup requests</li>
                <li style={{ marginBottom: '8px' }}>Vague posts without a clear activity (e.g., "looking for friends")</li>
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
                fontSize: '15px', 
                color: '#444', 
                lineHeight: 1.7,
                margin: 0,
              }}>
                When you connect with someone, be respectful and reliable. Show up when you say you will. Meet in public places. If plans change, let the other person know. Remember that everyone on Common is a real person looking to do something fun or meaningful.
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
                fontSize: '15px', 
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
              fontSize: '14px', 
              color: '#888', 
              lineHeight: 1.6,
              margin: 0,
            }}>
              Posts that don't follow these guidelines won't be approved. If you have questions, reach out to us at <a href="mailto:hello@common-app.com" style={{ color: '#444' }}>hello@common-app.com</a>
            </p>
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
          pendingPostsCount={pendingPostsCount}
          pendingReportsCount={pendingReportsCount}
        />
      )}
    </div>
  );
}