'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';

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
  reporter_profile?: {
    first_name: string;
  } | null;
}

export default function AdminReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed'>('pending');
  const [actioningReport, setActioningReport] = useState<string | null>(null);

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

  // Fetch reports
  useEffect(() => {
    async function fetchReports() {
      if (!user) return;

      // Note: You'll need to create RLS policies that allow admins to view all reports
      // For now, this uses the service role via an edge function, or you can add a specific admin check
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
        posts: report.posts?.[0] || null
      })) || []);
      setLoading(false);
    }

    if (user) {
      fetchReports();
    }
  }, [user, filter]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleMarkReviewed = async (reportId: string) => {
    setActioningReport(reportId);
    const { error } = await supabase
      .from('reports')
      .update({ status: 'reviewed' })
      .eq('id', reportId);

    if (error) {
      console.error('Error updating report:', error);
      alert('Failed to update report');
    } else {
      // Update local state
      setReports(prev => prev.map(r => 
        r.id === reportId ? { ...r, status: 'reviewed' as const } : r
      ));
    }
    setActioningReport(null);
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
    }
    setActioningReport(null);
  };

  const handleHidePost = async (reportId: string, postId: string) => {
    if (!confirm('Are you sure you want to hide this post? It will no longer be visible to users.')) {
      return;
    }

    setActioningReport(reportId);
    
    // Update post status to 'hidden'
    const { error: postError } = await supabase
      .from('posts')
      .update({ status: 'hidden' })
      .eq('id', postId);

    if (postError) {
      console.error('Error hiding post:', postError);
      alert('Failed to hide post');
      setActioningReport(null);
      return;
    }

    // Mark report as reviewed
    const { error: reportError } = await supabase
      .from('reports')
      .update({ status: 'reviewed' })
      .eq('id', reportId);

    if (reportError) {
      console.error('Error updating report:', reportError);
    }

    // Update local state
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

    setActioningReport(null);
  };

  const handleDeletePost = async (reportId: string, postId: string) => {
    if (!confirm('Are you sure you want to DELETE this post? This cannot be undone.')) {
      return;
    }

    setActioningReport(reportId);
    
    // Delete the post (will cascade to threads/messages if set up)
    const { error: postError } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);

    if (postError) {
      console.error('Error deleting post:', postError);
      alert('Failed to delete post');
      setActioningReport(null);
      return;
    }

    // Mark report as reviewed
    await supabase
      .from('reports')
      .update({ status: 'reviewed' })
      .eq('id', reportId);

    // Remove from local state
    setReports(prev => prev.filter(r => r.id !== reportId));
    setActioningReport(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#D4594F';
      case 'reviewed': return '#4A9D6B';
      case 'dismissed': return '#888';
      default: return '#888';
    }
  };

  if (!user || loading) {
    return null;
  }

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden',
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
        {/* Sidebar */}
        <div style={{
          width: '224px',
          flexShrink: 0,
          borderRight: '1px solid #f0f0f0',
          background: 'rgba(250, 250, 250, 0.5)',
          overflow: 'hidden',
        }}>
          <Sidebar
            userId={user.id}
            selectedThreadId={null}
            onSelectThread={(threadId) => router.push(`/?thread=${threadId}`)}
            onNavigateToMyActivity={() => router.push('/my-activity')}
            onLogout={handleLogout}
            activeItem={null}
          />
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: '800px', width: '100%', margin: '0 auto', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 700 }}>
                Reports
              </h1>
              
              {/* Filter buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {['all', 'pending', 'reviewed'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f as typeof filter)}
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: '20px',
                      background: filter === f ? '#000' : '#f5f5f5',
                      color: filter === f ? '#fff' : '#666',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {reports.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '48px 24px',
                color: '#888',
              }}>
                <p style={{ fontSize: '16px' }}>
                  {filter === 'pending' ? 'No pending reports' : `No ${filter} reports`}
                </p>
              </div>
            ) : (
              <div>
                {reports.map(report => (
                  <div
                    key={report.id}
                    style={{
                      background: '#fff',
                      border: '1px solid #e0e0e0',
                      borderRadius: '16px',
                      padding: '20px',
                      marginBottom: '16px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                  >
                    {/* Report header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
                      <div>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            background: `${getStatusColor(report.status)}20`,
                            color: getStatusColor(report.status),
                            textTransform: 'capitalize',
                          }}
                        >
                          {report.status}
                        </span>
                        <span style={{ marginLeft: '12px', fontSize: '13px', color: '#888' }}>
                          {formatDate(report.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Report reason */}
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '13px', color: '#888', marginBottom: '4px' }}>
                        Reason:
                      </div>
                      <div style={{ fontSize: '14px', color: '#444', fontWeight: 500 }}>
                        {report.reason}
                      </div>
                    </div>

                    {/* Reported post */}
                    {report.posts && (
                      <div
                        style={{
                          background: '#fafafa',
                          border: '1px solid #e0e0e0',
                          borderRadius: '12px',
                          padding: '16px',
                          marginBottom: '16px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                          <div>
                            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>
                              {report.posts.title}
                            </div>
                            <div style={{ fontSize: '14px', color: '#666' }}>
                              {report.posts.location} · {report.posts.time}
                            </div>
                            {report.posts.notes && (
                              <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
                                {report.posts.notes}
                              </div>
                            )}
                            <div style={{ fontSize: '13px', color: '#888', marginTop: '8px' }}>
                              Posted by: {report.posts.name}
                            </div>
                          </div>
                          {report.posts.status === 'hidden' && (
                            <span
                              style={{
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 600,
                                background: '#dc262620',
                                color: '#dc2626',
                              }}
                            >
                              Hidden
                            </span>
                          )}
                        </div>
                        <a
                          href={`/post/${report.posts.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: '13px',
                            color: '#666',
                            textDecoration: 'underline',
                          }}
                        >
                          View post →
                        </a>
                      </div>
                    )}

                    {/* Actions */}
                    {report.status === 'pending' && report.posts && (
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => handleHidePost(report.id, report.posts!.id)}
                          disabled={actioningReport === report.id}
                          style={{
                            padding: '10px 20px',
                            border: 'none',
                            borderRadius: '20px',
                            background: '#dc2626',
                            color: '#fff',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: actioningReport === report.id ? 'not-allowed' : 'pointer',
                            opacity: actioningReport === report.id ? 0.5 : 1,
                          }}
                        >
                          Hide post
                        </button>
                        <button
                          onClick={() => handleDeletePost(report.id, report.posts!.id)}
                          disabled={actioningReport === report.id}
                          style={{
                            padding: '10px 20px',
                            border: '1px solid #dc2626',
                            borderRadius: '20px',
                            background: '#fff',
                            color: '#dc2626',
                            fontSize: '14px',
                            fontWeight: 500,
                            cursor: actioningReport === report.id ? 'not-allowed' : 'pointer',
                            opacity: actioningReport === report.id ? 0.5 : 1,
                          }}
                        >
                          Delete post
                        </button>
                        <button
                          onClick={() => handleDismiss(report.id)}
                          disabled={actioningReport === report.id}
                          style={{
                            padding: '10px 20px',
                            border: '1px solid #e0e0e0',
                            borderRadius: '20px',
                            background: '#fff',
                            color: '#666',
                            fontSize: '14px',
                            fontWeight: 500,
                            cursor: actioningReport === report.id ? 'not-allowed' : 'pointer',
                            opacity: actioningReport === report.id ? 0.5 : 1,
                          }}
                        >
                          Dismiss report
                        </button>
                        <button
                          onClick={() => handleMarkReviewed(report.id)}
                          disabled={actioningReport === report.id}
                          style={{
                            padding: '10px 20px',
                            border: '1px solid #4A9D6B',
                            borderRadius: '20px',
                            background: '#fff',
                            color: '#4A9D6B',
                            fontSize: '14px',
                            fontWeight: 500,
                            cursor: actioningReport === report.id ? 'not-allowed' : 'pointer',
                            opacity: actioningReport === report.id ? 0.5 : 1,
                          }}
                        >
                          Mark reviewed (keep post)
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}