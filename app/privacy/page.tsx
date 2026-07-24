'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useUnreadCount } from '@/lib/useUnreadCount';
import { User } from '@supabase/supabase-js';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import Sidebar from '../components/Sidebar';

const LAST_UPDATED = '23 July 2026';

export default function PrivacyPage() {
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
    await supabase.auth.signOut();
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
      fontFamily: "'Satoshi', 'Inter', system-ui, sans-serif",
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
              Privacy Policy
            </h1>
            <p style={{ fontSize: '14px', color: '#888', marginBottom: '32px' }}>
              Last updated {LAST_UPDATED}
            </p>

            <p style={bodyP}>
              common is a place to share what you&apos;re up to and find people to join in. This
              page explains what information we collect when you use common, why we collect it,
              who we share it with, and the choices you have. If anything here is unclear, email
              us at <a href="mailto:hello@common-social.com" style={{ color: '#444' }}>hello@common-social.com</a>{' '}
              and we&apos;ll explain it in plain English.
            </p>

            <h2 style={sectionH2}>Information we collect</h2>
            <p style={bodyP}>
              <strong>Account information.</strong> When you sign up, we collect your email
              address and password to create your account. You can also add a first name, profile
              photo, and date of birth to your profile.
            </p>
            <p style={bodyP}>
              <strong>Content you share.</strong> This includes the activities you post (title,
              location, time, notes, who you&apos;d like to do it with), messages you send in
              chats, friend connections, and any reports you file.
            </p>
            <p style={bodyP}>
              <strong>Location.</strong> If you post an activity with a specific place, that
              location is visible to other users as part of the post. If you use &quot;nearest to
              me&quot; sorting or distance filtering, we ask your device for your approximate
              location - this is used locally to sort and filter the feed and is not stored on our
              servers beyond your current session. If you search for a place by name, that search
              text is sent to OpenStreetMap&apos;s Nominatim service to look up matching locations.
            </p>
            <p style={bodyP}>
              <strong>Device and push notification data.</strong> If you allow notifications, we
              store a device token (via Apple/Google&apos;s push services) or a browser push
              subscription so we can send you alerts about new messages and activity. We don&apos;t
              use this token for anything other than sending you notifications.
            </p>
            <p style={bodyP}>
              <strong>Usage information.</strong> We keep basic records needed to run the service,
              such as when a thread was last read, when a post was created, and moderation history
              (reports, blocks) so we can keep the community safe.
            </p>

            <h2 style={sectionH2}>How we use your information</h2>
            <ul style={ul}>
              <li>To create and maintain your account and let you sign in</li>
              <li>To show your posts to other users and connect you with people doing similar things</li>
              <li>To deliver messages between you and people you&apos;re coordinating with</li>
              <li>To send you email and push notifications about activity relevant to you (new messages, interest in your posts) - you can turn email notifications off in Settings</li>
              <li>To sort and filter activities by distance, using your device&apos;s location if you choose to share it</li>
              <li>To review reports, enforce our guidelines, and keep the community safe</li>
              <li>To respond to your support requests</li>
            </ul>
            <p style={bodyP}>
              We do not sell your personal information, and we do not use your data to serve
              third-party advertising.
            </p>

            <h2 style={sectionH2}>Who we share information with</h2>
            <p style={bodyP}>
              We use a small number of service providers to run common. They only receive the
              information needed to provide their service to us, and they&apos;re not permitted to
              use it for their own purposes:
            </p>
            <ul style={ul}>
              <li><strong>Supabase</strong> - hosts our database, authentication, and backend functions</li>
              <li><strong>Google Firebase Cloud Messaging</strong> - delivers push notifications to Android and iOS devices</li>
              <li><strong>Resend</strong> - sends transactional emails (e.g. new message notifications)</li>
              <li><strong>OpenStreetMap (Nominatim)</strong> - looks up locations when you search for a place by name</li>
            </ul>
            <p style={bodyP}>
              Other users of common can see the content of your posts, your first name, your
              profile photo and age (if provided), and messages you send them directly. Friends-only
              posts are only visible to people you&apos;ve connected with as friends. We may also
              disclose information if required by law, or to protect the safety of our users.
            </p>

            <h2 style={sectionH2}>How long we keep your information</h2>
            <p style={bodyP}>
              We keep your account and content for as long as your account is active. If you delete
              your account, we remove your profile and posts, though some information may be
              retained for a limited period where needed for safety, legal, or fraud-prevention
              purposes (for example, records related to a report you filed or were the subject of).
            </p>

            <h2 style={sectionH2}>Your choices and rights</h2>
            <ul style={ul}>
              <li>You can edit or delete your posts at any time</li>
              <li>You can turn off email notifications in Settings, and revoke push notification permission in your device settings at any time</li>
              <li>You can block another user, which removes you from shared conversations with them</li>
              <li>You can request a copy of your data, or ask us to delete your account and associated data, by emailing us</li>
            </ul>
            <p style={bodyP}>
              If you&apos;re in the UK or EU, you have rights under data protection law (including
              the right to access, correct, delete, or port your data, and to object to certain
              processing). If you&apos;re in the US, you may have similar rights under applicable
              state privacy laws. We&apos;ll respond to any request within a reasonable time.
            </p>

            <h2 style={sectionH2}>Children</h2>
            <p style={bodyP}>
              common involves coordinating in-person meetups with other people and isn&apos;t
              intended for children. You must meet the minimum age required to use common in your
              country to create an account.
            </p>

            <h2 style={sectionH2}>Security</h2>
            <p style={bodyP}>
              We use industry-standard measures (including encryption in transit and access
              controls) to protect your information. No method of transmission or storage is
              completely secure, so we can&apos;t guarantee absolute security.
            </p>

            <h2 style={sectionH2}>Changes to this policy</h2>
            <p style={bodyP}>
              If we make material changes to this policy, we&apos;ll update the date at the top of
              this page and, where appropriate, let you know in the app.
            </p>

            <h2 style={sectionH2}>Contact us</h2>
            <p style={bodyP}>
              Questions about this policy or your data? Email us at{' '}
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
