'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import BottomNav from '../../components/BottomNav';

interface Report {
  id: string;
  post_id: string | null;
  thread_id: string | null;
  reported_by: string;
  reason: string;
  status: 'pending' | 'reviewed' | 'dismissed';
  created_at: string;
  posts?: {
    id: string;
    title: string;
    location: string;
    time: string;
    notes: string | null;
    name: string;
    user_id: string;
    status: string;
  } | null;
}

export default function AdminReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed'>('pending');
  const [actioningReport, setActioningReport] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [pendingPostsCount, setPendingPostsCount] = useState(0);
  const [pendingReportsCount, setPendingReportsCount] = useState(0);
  const [confirmRemove, setConfirmRemove] = useState<{
    reportId: string;
    postId: string;
    postTitle: string;
  } | null>(null);

  // Check screen size
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Check auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        router.push('/');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        router.push('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  // Fetch reports and counts
  useEffect(() => {
    async function fetchReports() {
      if (!user) return;

      const query = supabase
        .from('reports')
        .select(`
          id,
          post_id,
          thread_id,
          reported_by,
          reason,
          status,
          created_at,
          posts (
            id,
            title,
            location,
            time,
            notes,
            name,
            user_id,
            status
          )
        `)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching reports:', error);
        setLoading(false);
        return;
      }

      setReports(data?.map(report => ({
        ...report,
        posts: Array.isArray(report.posts) ? report.posts[0] || null : report.posts
      })) || []);
      setLoading(false);
    }

    async function fetchCounts() {
      const [postsRes, reportsRes] = await Promise.all([
        supabase.from('posts').select('id', { count: 'exact' }).eq('status', 'pending'),
        supabase.from('reports').select('id', { count: 'exact' }).eq('status', 'pending'),
      ]);
      setPendingPostsCount(postsRes.count || 0);
      setPendingReportsCount(reportsRes.count || 0);
    }

    if (user) {
      fetchReports();
      fetchCounts();
    }
  }, [user, filter]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleDismiss = async (reportId: string) => {
    setActioningReport(reportId);

    const { error } = await supabase
      .from('reports')
      .update({ status: 'dismissed' })
      .eq('id', reportId);

    if (error) {
      console.error('Error dismissing report:', error);
      alert('Failed to dismiss report');
    } else {
      setReports(prev => prev.map(r => 
        r.id === reportId ? { ...r, status: 'dismissed' as const } : r
      ));
      setPendingReportsCount(prev => Math.max(0, prev - 1));
    }
    setActioningReport(null);
  };

  const handleRemovePost = async (reportId: string, postId: string) => {
    setActioningReport(reportId);

    // Get post details for the notification
    const report = reports.find(r => r.id === reportId);
    const postTitle = report?.posts?.title || 'Unknown';
    const postUserId = report?.posts?.user_id;

    // Soft delete - set status to 'hidden'
    const { error: postError } = await supabase
      .from('posts')
      .update({ status: 'hidden' })
      .eq('id', postId);

    if (postError) {
      console.error('Error removing post:', postError);
      alert('Failed to remove post');
      setActioningReport(null);
      return;
    }

    // Mark report as reviewed
    await supabase
      .from('reports')
      .update({ status: 'reviewed' })
      .eq('id', reportId);

    // Send removal notification email
    if (postUserId) {
      try {
        await supabase.functions.invoke('post-moderation-notification', {
          body: {
            postId,
            userId: postUserId,
            postTitle,
            action: 'removed',
          },
        });
      } catch (emailError) {
        console.error('Failed to send removal email:', emailError);
        // Don't block on email failure
      }
    }

    setReports(prev => prev.map(r => {
      if (r.id === reportId) {
        return {
          ...r,
          status: 'reviewed' as const,
          posts: r.posts ? { ...r.posts, status: 'hidden' } : null
        };
      }
      return r;
    }));
    setPendingReportsCount(prev => Math.max(0, prev - 1));
    setActioningReport(null);
    setConfirmRemove(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString('en-GB', { 
        day: 'numeric',
        month: 'short',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string; label: string }> = {
      pending: { bg: '#FBEEED', color: '#D4594F', label: 'Pending' },
      reviewed: { bg: '#EDF7F0', color: '#4A9D6B', label: 'Removed' },
      dismissed: { bg: '#F5F5F5', color: '#888888', label: 'Dismissed' },
    };
    return styles[status] || styles.dismissed;
  };

  const handleMobileTabChange = (tab: 'home' | 'messages' | 'activity' | 'menu') => {
    if (tab === 'home') {
      router.push('/');
    } else if (tab === 'messages') {
      router.push('/?messages=open');
    } else if (tab === 'activity') {
      router.push('/my-activity');
    }
  };

  const pendingCount = reports.filter(r => r.status === 'pending').length;

  if (!user || loading) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        fontFamily: "'Satoshi', 'Inter', system-ui, sans-serif",
        color: '#888',
        fontSize: '14px',
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ 
      height: '100vh', 
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

      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'row',
        overflow: 'hidden',
      }}>
        {/* Sidebar - Desktop only */}
        {!isMobile && (
          <div style={{
            width: '224px',
            flexShrink: 0,
            borderRight: '1px solid #F0F0F0',
            background: 'rgba(250, 250, 250, 0.5)',
            overflow: 'hidden',
          }}>
            <Sidebar
              userId={user.id}
              selectedThreadId={null}
              onSelectThread={(threadId) => router.push(`/?thread=${threadId}`)}
              onNavigateToMyActivity={() => router.push('/my-activity')}
              onLogout={handleLogout}
              activeItem="admin-reports"
            />
          </div>
        )}

        {/* Main content */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto',
          background: '#FAFAFA',
          paddingBottom: isMobile ? '80px' : '0',
        }}>
          <div style={{ 
            maxWidth: '720px', 
            width: '100%', 
            margin: '0 auto', 
            padding: isMobile ? '16px' : '32px 24px',
          }}>
            {/* Page header */}
            <div style={{ marginBottom: isMobile ? '20px' : '32px' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                marginBottom: '8px',
                flexWrap: 'wrap',
              }}>
                <h1 style={{ 
                  fontSize: isMobile ? '20px' : '24px', 
                  fontWeight: 700, 
                  color: '#000',
                  letterSpacing: '-0.5px',
                  margin: 0,
                }}>
                  Reports
                </h1>
                {filter === 'pending' && pendingCount > 0 && (
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#D4594F',
                    background: '#FBEEED',
                    padding: '4px 12px',
                    borderRadius: '16px',
                  }}>
                    {pendingCount} pending
                  </span>
                )}
              </div>
              <p style={{ 
                fontSize: '14px', 
                color: '#888', 
                margin: 0,
              }}>
                Review and take action on reported content
              </p>
            </div>

            {/* Filter tabs */}
            <div style={{ 
              display: 'flex', 
              gap: '8px',
              marginBottom: '24px',
              borderBottom: '1px solid #E0E0E0',
              paddingBottom: '16px',
              overflowX: 'auto',
            }}>
              {[
                { key: 'pending', label: 'Pending' },
                { key: 'reviewed', label: 'Actioned' },
                { key: 'all', label: 'All' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key as typeof filter)}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '24px',
                    background: filter === tab.key ? '#000' : 'transparent',
                    color: filter === tab.key ? '#fff' : '#666',
                    fontSize: '14px',
                    fontWeight: filter === tab.key ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Reports list */}
            {reports.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '64px 24px',
                color: '#888',
              }}>
                <div style={{ 
                  fontSize: '40px', 
                  marginBottom: '16px',
                  opacity: 0.5,
                }}>
                  ✓
                </div>
                <p style={{ fontSize: '16px', fontWeight: 500, color: '#444', marginBottom: '4px' }}>
                  {filter === 'pending' ? 'All clear' : `No ${filter === 'reviewed' ? 'actioned' : filter} reports`}
                </p>
                <p style={{ fontSize: '14px', color: '#888' }}>
                  {filter === 'pending' 
                    ? 'No reports waiting for review' 
                    : 'Nothing to show here'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {reports.map(report => {
                  const statusBadge = getStatusBadge(report.status);
                  const isActioning = actioningReport === report.id;
                  return (
                    <div
                      key={report.id}
                      style={{
                        background: '#fff',
                        border: '1px solid #E0E0E0',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      }}
                    >
                      {/* Report header */}
                      <div style={{ 
                        padding: isMobile ? '12px 16px' : '16px 20px',
                        borderBottom: '1px solid #F0F0F0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '12px',
                        flexWrap: 'wrap',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '4px 12px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              background: statusBadge.bg,
                              color: statusBadge.color,
                            }}
                          >
                            {statusBadge.label}
                          </span>
                          <span style={{ 
                            fontSize: '14px', 
                            fontWeight: 500,
                            color: '#444',
                          }}>
                            {report.reason}
                          </span>
                        </div>
                        <span style={{ 
                          fontSize: '13px', 
                          color: '#888',
                          flexShrink: 0,
                        }}>
                          {formatDate(report.created_at)}
                        </span>
                      </div>

                      {/* Reported post preview */}
                      {report.posts && (
                        <div style={{ padding: isMobile ? '16px' : '20px' }}>
                          <div style={{
                            background: '#FAFAFA',
                            borderRadius: '12px',
                            padding: isMobile ? '12px' : '16px',
                            border: '1px solid #F0F0F0',
                          }}>
                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'flex-start',
                              marginBottom: '8px',
                              gap: '12px',
                            }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ 
                                  fontSize: '16px', 
                                  fontWeight: 600, 
                                  color: '#000',
                                  marginBottom: '4px',
                                }}>
                                  {report.posts.title}
                                </div>
                                <div style={{ 
                                  fontSize: '14px', 
                                  color: '#666',
                                }}>
                                  {report.posts.location} · {report.posts.time}
                                </div>
                              </div>
                              {report.posts.status === 'hidden' && (
                                <span style={{
                                  padding: '4px 10px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  background: '#FBEEED',
                                  color: '#D4594F',
                                  flexShrink: 0,
                                }}>
                                  Removed
                                </span>
                              )}
                            </div>

                            {report.posts.notes && (
                              <p style={{ 
                                fontSize: '14px', 
                                color: '#666', 
                                margin: '8px 0',
                                lineHeight: 1.5,
                              }}>
                                {report.posts.notes}
                              </p>
                            )}

                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              marginTop: '12px',
                              paddingTop: '12px',
                              borderTop: '1px solid #E0E0E0',
                              flexWrap: 'wrap',
                              gap: '8px',
                            }}>
                              <span style={{ 
                                fontSize: '13px', 
                                color: '#888',
                              }}>
                                Posted by {report.posts.name}
                              </span>
                              <a
                                href={`/post/${report.posts.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontSize: '13px',
                                  color: '#444',
                                  textDecoration: 'underline',
                                  textUnderlineOffset: '2px',
                                }}
                              >
                                View post →
                              </a>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Actions - only show for pending reports */}
                      {report.status === 'pending' && report.posts && (
                        <div style={{ 
                          padding: isMobile ? '12px 16px' : '16px 20px',
                          borderTop: '1px solid #F0F0F0',
                          background: '#FAFAFA',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                        }}>
                          <button
                            onClick={() => setConfirmRemove({ 
                              reportId: report.id, 
                              postId: report.posts!.id,
                              postTitle: report.posts!.title,
                            })}
                            disabled={isActioning}
                            style={{
                              padding: '10px 20px',
                              border: 'none',
                              borderRadius: '24px',
                              background: '#D4594F',
                              color: '#fff',
                              fontSize: '14px',
                              fontWeight: 600,
                              cursor: isActioning ? 'not-allowed' : 'pointer',
                              opacity: isActioning ? 0.5 : 1,
                              transition: 'all 0.15s ease',
                            }}
                          >
                            Remove post
                          </button>
                          <button
                            onClick={() => handleDismiss(report.id)}
                            disabled={isActioning}
                            style={{
                              padding: '10px 20px',
                              border: '1px solid #E0E0E0',
                              borderRadius: '24px',
                              background: '#fff',
                              color: '#666',
                              fontSize: '14px',
                              fontWeight: 500,
                              cursor: isActioning ? 'not-allowed' : 'pointer',
                              opacity: isActioning ? 0.5 : 1,
                              transition: 'all 0.15s ease',
                            }}
                          >
                            Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Nav - Mobile only */}
      {isMobile && (
        <BottomNav
          activeTab="menu"
          onTabChange={handleMobileTabChange}
          onLogout={handleLogout}
          isAdmin={true}
          pendingPostsCount={pendingPostsCount}
          pendingReportsCount={pendingReportsCount}
        />
      )}

      {/* Confirmation Modal */}
      {confirmRemove && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={() => setConfirmRemove(null)}
        >
          <div 
            style={{
              background: '#fff',
              borderRadius: '16px',
              padding: isMobile ? '24px' : '32px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ 
              fontSize: '18px', 
              fontWeight: 600, 
              color: '#000',
              marginBottom: '12px',
            }}>
              Remove this post?
            </h2>
            <p style={{ 
              fontSize: '14px', 
              color: '#666', 
              lineHeight: 1.6,
              marginBottom: '8px',
            }}>
              "{confirmRemove.postTitle}" will no longer be visible to users.
            </p>
            <p style={{ 
              fontSize: '13px', 
              color: '#888', 
              lineHeight: 1.5,
              marginBottom: '24px',
            }}>
              The post data will be retained in case you need to review it later.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmRemove(null)}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #E0E0E0',
                  borderRadius: '24px',
                  background: '#fff',
                  color: '#666',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemovePost(confirmRemove.reportId, confirmRemove.postId)}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '24px',
                  background: '#D4594F',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Remove post
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}