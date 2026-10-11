'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { signOut } from '@/lib/signOut';
import { useUnreadCount } from '@/lib/useUnreadCount';
import { User } from '@supabase/supabase-js';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import Sidebar from '../components/Sidebar';

const LAST_UPDATED = '11 October 2026';

export default function TermsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingReportsCount, setPendingReportsCount] = useState(0);
  const [mobileTab, setMobileTab] = useState<'home' | 'messages' | 'activity' | 'menu'>('menu');
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);

  const { unreadCount: threadCount } = useUnreadCount(user?.id, sidebarRefreshTrigger);

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
        const reportsRes = await supabase.from('reports').select('id', { count: 'exact' }).eq('status', 'pending');
        setPendingReportsCount(reportsRes.count || 0);
      }
    }
    checkAdmin();
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    window.location.href = '/';
  };

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

  const sectionH2: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 600,
    color: '#000',
    marginBottom: '12px',
    marginTop: '32px',
  };

  const bodyP: React.CSSProperties = {
    fontSize: '14px',
    color: '#444',
    lineHeight: 1.7,
    margin: '0 0 12px 0',
  };

  const ul: React.CSSProperties = {
    fontSize: '14px',
    color: '#444',
    lineHeight: 1.8,
    margin: '0 0 12px 0',
    paddingLeft: '20px',
  };

  return (
    <div style={{
      height: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: 'var(--font-family)',
    }}>
      <Header onLoginClick={() => {}} user={user} onLogout={handleLogout} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
        {user && !isMobile && (
          <div
            className="desktop-sidebar"
            style={{
              width: '224px',
              flexShrink: 0,
              borderRight: 'var(--border-light)',
              background: 'rgba(250, 250, 250, 0.5)',
              overflow: 'hidden',
            }}
          >
            <Sidebar
              userId={user.id}
              selectedThreadId={null}
              onSelectThread={(threadId) => router.push(`/?thread=${threadId}`)}
              onNavigateToMyActivity={() => router.push('/my-activity')}
              onLogout={handleLogout}
              activeItem={null}
              refreshTrigger={sidebarRefreshTrigger}
            />
          </div>
        )}

        <div style={{
          flex: 1,
          overflowY: 'auto',
          background: '#F5F0E3',
          padding: isMobile ? '24px 16px 100px' : '48px 24px',
        }}>
          <div style={{
            maxWidth: '720px',
            margin: '0 auto',
            background: '#FEFCF8',
            borderRadius: '16px',
            border: '1px solid #E5DFD8',
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
              Terms of Use
            </h1>
            <p style={{ fontSize: '14px', color: '#888', marginBottom: '32px' }}>
              Last updated {LAST_UPDATED}
            </p>

            <p style={bodyP}>
              These terms are the agreement between you and common. By creating an account or
              using common, you agree to them, and to our{' '}
              <a href="/guidelines" style={{ color: '#444' }}>community guidelines</a> and{' '}
              <a href="/privacy" style={{ color: '#444' }}>privacy policy</a>. They&apos;re short, so please read them.
            </p>

            <h2 style={sectionH2}>Who can use common</h2>
            <p style={bodyP}>
              You must be 18 or older to use common. Keep to one account, and make sure the details
              you give us are true. You&apos;re responsible for keeping your password safe and for
              what happens on your account.
            </p>

            <h2 style={sectionH2}>What common is for</h2>
            <p style={bodyP}>
              common is for sharing things you&apos;re doing and finding people to do them with.
              Posts should be personal invitations to activities you&apos;re taking part in
              yourself. Our <a href="/guidelines" style={{ color: '#444' }}>community guidelines</a> explain what
              fits and what doesn&apos;t.
            </p>

            <h2 style={sectionH2}>Zero tolerance for objectionable content and abuse</h2>
            <p style={bodyP}>
              We have zero tolerance for objectionable content and abusive users. You must not post,
              send or share anything that is:
            </p>
            <ul style={ul}>
              <li>harassing, bullying, threatening or abusive</li>
              <li>hateful or discriminatory, including on the basis of race, ethnicity, religion, disability, sex, gender identity or sexual orientation</li>
              <li>sexually explicit, or sexual in any way involving a minor</li>
              <li>violent, or encouraging violence, self harm or anything illegal</li>
              <li>spam, a scam, or a commercial promotion</li>
              <li>pretending to be someone else, or sharing someone&apos;s private information without their consent</li>
            </ul>
            <p style={bodyP}>
              Never use common to harm, follow, pressure or exploit anyone, in the app or in person.
            </p>

            <h2 style={sectionH2}>Reporting, blocking and what we do</h2>
            <p style={bodyP}>
              You can report any post or conversation, and block anyone, from the post or the
              conversation itself. We review every report within 24 hours. If something breaks these
              terms, we remove it, and we suspend or permanently ban the account responsible. We can
              do this without warning.
            </p>

            <h2 style={sectionH2}>Meeting people in person</h2>
            <p style={bodyP}>
              common helps you meet people you don&apos;t know yet. We don&apos;t run background
              checks, and we aren&apos;t part of the plans you make. Meet somewhere public, tell a
              friend where you&apos;re going, and leave if something feels wrong. You&apos;re
              responsible for your own safety and behaviour when you meet up. If anyone is in danger,
              contact the emergency services first, then let us know.
            </p>

            <h2 style={sectionH2}>Your content</h2>
            <p style={bodyP}>
              What you post is yours. By posting it, you let us store it and show it to other people
              on common so the service can work. You&apos;re responsible for what you post and send.
            </p>

            <h2 style={sectionH2}>Leaving common</h2>
            <p style={bodyP}>
              You can delete your account at any time in Settings. This deletes your posts,
              messages and profile.
            </p>

            <h2 style={sectionH2}>The service</h2>
            <p style={bodyP}>
              We work hard to keep common running and safe, but we provide it as it is and
              can&apos;t promise it will always be available or free of errors. As far as the law
              allows, we aren&apos;t responsible for how other people behave, in the app or in
              person. Nothing in these terms affects rights you have by law that can&apos;t be
              limited. These terms are governed by the laws of England and Wales.
            </p>

            <h2 style={sectionH2}>Changes to these terms</h2>
            <p style={bodyP}>
              If we change these terms, we&apos;ll update the date at the top of this page, and
              let you know in the app when the change matters.
            </p>

            <h2 style={sectionH2}>Contact us</h2>
            <p style={bodyP}>
              Questions about these terms? Email us at{' '}
              <a href="mailto:hello@common-social.com" style={{ color: '#444' }}>hello@common-social.com</a>.
            </p>
          </div>
        </div>
      </div>

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
