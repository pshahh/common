'use client';

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import Header from './components/Header';
import PostCard from './components/PostCard';
import AuthModal from './components/AuthModal';
import CreatePostModal from './components/CreatePostModal';
import InterestedModal from './components/InterestedModal';
import MessageSentModal from './components/MessageSentModal';
import ProfileCompletionModal from './components/ProfileCompletionModal';
import ReportModal from './components/ReportModal';
import ReportConfirmationModal from './components/ReportConfirmationModal';
import Sidebar from './components/Sidebar';
import MessageThread from './components/MessageThread';
import BottomNav from './components/BottomNav';
import MobileMessageList from './components/MobileMessageList';
import { sortByDistance, formatDistance, getDistanceToPost } from '@/lib/distance';

interface Post {
  id: string;
  title: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  time: string;
  notes: string | null;
  name: string;
  preference: string | null;
  people_interested: number;
  user_id: string;
  created_at: string;
  expires_at: string | null;
}

interface Profile {
  id: string;
  first_name: string;
  avatar_url: string | null;
  date_of_birth: string | null;
}

interface UserLocation {
  latitude: number;
  longitude: number;
  source: 'browser' | 'manual';
  name?: string;
}

interface LocationSuggestion {
  display_name: string;
  lat: string;
  lon: string;
}

// Separate component to avoid re-render issues
interface LocationSectionProps {
  sortBy: string;
  locationStatus: 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';
  userLocation: UserLocation | null;
  showLocationInput: boolean;
  setShowLocationInput: (show: boolean) => void;
  locationQuery: string;
  setLocationQuery: (query: string) => void;
  locationSuggestions: LocationSuggestion[];
  searchingLocation: boolean;
  selectManualLocation: (suggestion: LocationSuggestion) => void;
  requestBrowserLocation: () => void;
}

function LocationSection({
  sortBy,
  locationStatus,
  userLocation,
  showLocationInput,
  setShowLocationInput,
  locationQuery,
  setLocationQuery,
  locationSuggestions,
  searchingLocation,
  selectManualLocation,
  requestBrowserLocation,
}: LocationSectionProps) {
  if (sortBy !== 'nearest') return null;

  // Show requesting state
  if (locationStatus === 'requesting') {
    return (
      <div style={{
        padding: '12px 16px',
        background: '#fafafa',
        borderRadius: '12px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '14px',
        color: '#666',
      }}>
        <div style={{
          width: '16px',
          height: '16px',
          border: '2px solid #e0e0e0',
          borderTopColor: '#666',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        Getting your location...
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Show current location with option to change
  if (userLocation && !showLocationInput) {
    return (
      <div style={{
        padding: '12px 16px',
        background: '#f0fdf4',
        borderRadius: '12px',
        marginBottom: '16px',
        fontSize: '14px',
        color: '#166534',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span>
          📍 {userLocation.source === 'manual' && userLocation.name 
            ? `Sorting from ${userLocation.name}` 
            : 'Using your current location'}
        </span>
        <button
          onClick={() => setShowLocationInput(true)}
          style={{
            background: 'none',
            border: 'none',
            color: '#166534',
            textDecoration: 'underline',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Change
        </button>
      </div>
    );
  }

  // Show location input
  if (showLocationInput || locationStatus === 'denied' || locationStatus === 'unavailable') {
    return (
      <div style={{
        padding: '16px',
        background: '#fafafa',
        borderRadius: '12px',
        marginBottom: '16px',
      }}>
        <div style={{ 
          fontSize: '14px', 
          color: '#666', 
          marginBottom: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>
            {locationStatus === 'denied' 
              ? 'Location access denied. Enter a location manually:' 
              : locationStatus === 'unavailable'
              ? 'Could not get your location. Enter one manually:'
              : 'Enter your location:'}
          </span>
          {userLocation && (
            <button
              onClick={() => setShowLocationInput(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#666',
                cursor: 'pointer',
                fontSize: '18px',
              }}
            >
              ×
            </button>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Search for a location (e.g. Hackney, London)"
            value={locationQuery}
            onChange={(e) => setLocationQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '1px solid #e0e0e0',
              borderRadius: '12px',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {searchingLocation && (
            <div style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '12px',
              color: '#888',
            }}>
              Searching...
            </div>
          )}
          {locationSuggestions.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '12px',
              marginTop: '4px',
              zIndex: 10,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}>
              {locationSuggestions.map((suggestion, index) => (
                <div
                  key={index}
                  onClick={() => selectManualLocation(suggestion)}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    borderBottom: index < locationSuggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
                    fontSize: '14px',
                    color: '#444',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#fafafa')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                >
                  {suggestion.display_name}
                </div>
              ))}
            </div>
          )}
        </div>
        {locationStatus !== 'denied' && !userLocation && (
          <button
            onClick={requestBrowserLocation}
            style={{
              marginTop: '12px',
              background: 'none',
              border: 'none',
              color: '#666',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Try using my current location instead
          </button>
        )}
      </div>
    );
  }

  return null;
}

function HomeContent() {
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInterestedModal, setShowInterestedModal] = useState(false);
  const [showMessageSentModal, setShowMessageSentModal] = useState(false);
  const [showProfileCompletionModal, setShowProfileCompletionModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'post' | 'interest' | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('nearest');

  // Report modal state
  const [showReportModal, setShowReportModal] = useState(false);
  const [showReportConfirmation, setShowReportConfirmation] = useState(false);
  const [reportPostId, setReportPostId] = useState<string | null>(null);
  const [reportThreadId, setReportThreadId] = useState<string | null>(null);

  // Track posts user has expressed interest in
  const [userInterestedPostIds, setUserInterestedPostIds] = useState<Set<string>>(new Set());

  // Location state
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable'>('idle');
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [searchingLocation, setSearchingLocation] = useState(false);

  // Mobile state
  const [mobileTab, setMobileTab] = useState<'home' | 'messages' | 'activity' | 'menu'>('home');
  const [showMobileMessages, setShowMobileMessages] = useState(false);
  const [showMobileThread, setShowMobileThread] = useState(false);

  // Sidebar refresh trigger (increment to refresh)
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);

  // Admin state for mobile nav
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingPostsCount, setPendingPostsCount] = useState(0);
  const [pendingReportsCount, setPendingReportsCount] = useState(0);

  // Thread count for mobile nav badge
  const [threadCount, setThreadCount] = useState(0);

  // Check for mobile viewport
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Read thread ID from URL query params
  const searchParams = useSearchParams();

  // Open thread from URL query parameter (e.g., from email link)
  useEffect(() => {
    const threadId = searchParams.get('thread');
    if (threadId && user) {
      setSelectedThreadId(threadId);
      if (isMobile) {
        setShowMobileThread(true);
      }
    }
  }, [searchParams, user, isMobile]);

  // Check auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check admin status and fetch counts
  useEffect(() => {
    async function checkAdminAndCounts() {
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (!error && data?.is_admin) {
        setIsAdmin(true);

        const { count: reportsCount } = await supabase
          .from('reports')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        setPendingReportsCount(reportsCount || 0);

        const { count: postsCount } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        setPendingPostsCount(postsCount || 0);
      }

      // Fetch thread count for badge
      const { count: threads } = await supabase
        .from('threads')
        .select('*', { count: 'exact', head: true })
        .contains('participant_ids', [user.id]);
      setThreadCount(threads || 0);
    }

    checkAdminAndCounts();
  }, [user]);

  // Fetch posts and profiles
  useEffect(() => {
    async function fetchPostsAndProfiles() {
      // Fetch blocked users first if logged in
      let blockedUserIds: string[] = [];
      if (user) {
        const { data: blockedData } = await supabase
          .from('blocked_users')
          .select('blocked_user_id')
          .eq('user_id', user.id);
        
        if (blockedData) {
          blockedUserIds = blockedData.map(b => b.blocked_user_id);
        }

        // Also get users who blocked the current user
        const { data: blockedByData } = await supabase
          .from('blocked_users')
          .select('user_id')
          .eq('blocked_user_id', user.id);
        
        if (blockedByData) {
          blockedUserIds = [...blockedUserIds, ...blockedByData.map(b => b.user_id)];
        }
      }

      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .eq('status', 'approved')
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false });

      if (postsError) {
        console.error('Error fetching posts:', postsError);
        setLoading(false);
        return;
      }

      // Filter out posts from blocked users
      const filteredPosts = postsData?.filter(post => !blockedUserIds.includes(post.user_id)) || [];
      setPosts(filteredPosts);

      // Fetch profiles for all post authors
      if (filteredPosts.length > 0) {
        const userIds = [...new Set(filteredPosts.map(p => p.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, first_name, avatar_url, date_of_birth')
          .in('id', userIds);

        if (profilesData) {
          const profileMap: Record<string, Profile> = {};
          profilesData.forEach(p => {
            profileMap[p.id] = p;
          });
          setProfiles(profileMap);
        }
      }

      setLoading(false);
    }

    fetchPostsAndProfiles();
  }, [user]);

  // Fetch posts the user has already expressed interest in (via threads)
  useEffect(() => {
    async function fetchUserInterestedPosts() {
      if (!user) {
        setUserInterestedPostIds(new Set());
        return;
      }

      const { data: threads } = await supabase
        .from('threads')
        .select('post_id')
        .contains('participant_ids', [user.id]);

      if (threads) {
        const postIds = new Set(threads.map(t => t.post_id));
        setUserInterestedPostIds(postIds);
      }
    }

    fetchUserInterestedPosts();
  }, [user]);

  // Fetch current user's profile when logged in
  useEffect(() => {
    async function fetchCurrentUserProfile() {
      if (!user) {
        setCurrentUserProfile(null);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, avatar_url, date_of_birth')
        .eq('id', user.id)
        .single();

      if (data) {
        setCurrentUserProfile(data);
      }
    }

    fetchCurrentUserProfile();
  }, [user]);

  // Request browser location
  const requestBrowserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('unavailable');
      setShowLocationInput(true);
      return;
    }

    setLocationStatus('requesting');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          source: 'browser',
        });
        setLocationStatus('granted');
        setShowLocationInput(false);
      },
      (err) => {
        console.log('Geolocation error:', err.code, err.message);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationStatus('denied');
        } else {
          setLocationStatus('unavailable');
        }
        setShowLocationInput(true);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 30 * 60 * 1000,
      }
    );
  }, []);

  // Request location when sorting by nearest
  useEffect(() => {
    if (sortBy === 'nearest' && locationStatus === 'idle') {
      requestBrowserLocation();
    }
  }, [sortBy, locationStatus, requestBrowserLocation]);

  // Search for locations (debounced)
  useEffect(() => {
    if (locationQuery.length < 3) {
      setLocationSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingLocation(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationQuery)}&limit=5&countrycodes=gb`
        );
        const data = await response.json();
        setLocationSuggestions(data);
      } catch (err) {
        console.error('Location search failed:', err);
      }
      setSearchingLocation(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [locationQuery]);

  // Select a manual location
  const selectManualLocation = useCallback((suggestion: LocationSuggestion) => {
    const shortName = suggestion.display_name.split(',').slice(0, 2).join(',');
    setUserLocation({
      latitude: parseFloat(suggestion.lat),
      longitude: parseFloat(suggestion.lon),
      source: 'manual',
      name: shortName,
    });
    setLocationStatus('granted');
    setShowLocationInput(false);
    setLocationQuery('');
    setLocationSuggestions([]);
  }, []);

  // Filter out posts the user has already expressed interest in (and their own posts)
  const filteredPosts = useMemo(() => {
    if (!user) return posts;
    return posts.filter(post => {
      // Don't show user's own posts
      if (post.user_id === user.id) return false;
      // Don't show posts user has already expressed interest in
      if (userInterestedPostIds.has(post.id)) return false;
      return true;
    });
  }, [posts, user, userInterestedPostIds]);

  // Sort posts based on selected sort option
  const sortedPosts = useMemo(() => {
    const postsToSort = user ? filteredPosts : posts;

    if (sortBy === 'nearest' && userLocation) {
      return sortByDistance(postsToSort, userLocation.latitude, userLocation.longitude);
    } else if (sortBy === 'soon') {
      // Sort by expires_at ascending (soonest first)
      // Posts without expires_at go to the end
      return [...postsToSort].sort((a, b) => {
        if (!a.expires_at && !b.expires_at) return 0;
        if (!a.expires_at) return 1;
        if (!b.expires_at) return -1;
        return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime();
      });
    } else {
      // Default: recently added - sort by created_at descending (newest first)
      return [...postsToSort].sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
  }, [filteredPosts, posts, user, sortBy, userLocation]);

  // Get distance string for a post
  const getPostDistance = useCallback((post: Post): string | null => {
    if (sortBy !== 'nearest' || !userLocation) return null;
    const distance = getDistanceToPost(post, userLocation.latitude, userLocation.longitude);
    return distance !== null ? formatDistance(distance) : null;
  }, [sortBy, userLocation]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSelectedThreadId(null);
    setShowMobileThread(false);
    setShowMobileMessages(false);
  };

  const handleShareClick = () => {
    if (user) {
      setShowCreateModal(true);
    } else {
      setShowAuthModal(true);
    }
  };

  const handleInterestedClick = (post: Post) => {
    if (user) {
      if (post.user_id === user.id) {
        alert("You can't express interest in your own post");
        return;
      }
      setSelectedPost(post);
      setShowInterestedModal(true);
    } else {
      setShowAuthModal(true);
    }
  };

  const handleReportClick = (postId: string, threadId?: string) => {
    if (user) {
      setReportPostId(postId);
      setReportThreadId(threadId || null);
      setShowReportModal(true);
    } else {
      setShowAuthModal(true);
    }
  };

  const handleReportSuccess = () => {
    setShowReportModal(false);
    setReportPostId(null);
    setReportThreadId(null);
    setShowReportConfirmation(true);
  };

  const handleInterestedSuccess = (threadId: string) => {
    setShowInterestedModal(false);
    setShowMessageSentModal(true);
    setSelectedThreadId(threadId);

    // Add this post to the interested set so it disappears from feed immediately
    if (selectedPost) {
      setUserInterestedPostIds(prev => new Set([...prev, selectedPost.id]));
    }
    setSelectedPost(null);
    refreshPosts();

    // Check if profile is incomplete
    if (currentUserProfile && !currentUserProfile.avatar_url && !currentUserProfile.date_of_birth) {
      setPendingAction('interest');
    }

    // On mobile, show the thread
    if (isMobile) {
      setShowMobileThread(true);
    }
  };

  const handleMessageSentClose = () => {
    setShowMessageSentModal(false);
    // Show profile completion modal after message sent if profile is incomplete
    if (pendingAction === 'interest' && currentUserProfile && !currentUserProfile.avatar_url && !currentUserProfile.date_of_birth) {
      setShowProfileCompletionModal(true);
    }
    setPendingAction(null);
  };

  const refreshPosts = async () => {
    // Fetch blocked users
    let blockedUserIds: string[] = [];
    if (user) {
      const { data: blockedData } = await supabase
        .from('blocked_users')
        .select('blocked_user_id')
        .eq('user_id', user.id);
      
      if (blockedData) {
        blockedUserIds = blockedData.map(b => b.blocked_user_id);
      }

      const { data: blockedByData } = await supabase
        .from('blocked_users')
        .select('user_id')
        .eq('blocked_user_id', user.id);
      
      if (blockedByData) {
        blockedUserIds = [...blockedUserIds, ...blockedByData.map(b => b.user_id)];
      }
    }

    const { data: postsData, error } = await supabase
      .from('posts')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (!error && postsData) {
      const filteredPosts = postsData.filter(post => !blockedUserIds.includes(post.user_id));
      setPosts(filteredPosts);

      // Refresh profiles for any new authors
      const userIds = [...new Set(filteredPosts.map(p => p.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, avatar_url, date_of_birth')
        .in('id', userIds);

      if (profilesData) {
        const profileMap: Record<string, Profile> = {};
        profilesData.forEach(p => {
          profileMap[p.id] = p;
        });
        setProfiles(profileMap);
      }
    }
  };

  const handlePostCreated = () => {
    setShowCreateModal(false);
    refreshPosts();
    // Show profile completion modal after post creation if profile is incomplete
    if (currentUserProfile && !currentUserProfile.avatar_url && !currentUserProfile.date_of_birth) {
      setShowProfileCompletionModal(true);
    }
  };

  const handleProfileComplete = async () => {
    setShowProfileCompletionModal(false);
    // Refresh current user's profile
    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, avatar_url, date_of_birth')
        .eq('id', user.id)
        .single();

      if (data) {
        setCurrentUserProfile(data);
      }
    }
  };

  const handleProfileSkip = () => {
    setShowProfileCompletionModal(false);
  };

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    if (isMobile) {
      setShowMobileMessages(false);
      setShowMobileThread(true);
    }
  };

  const handleCloseThread = () => {
    setSelectedThreadId(null);
    if (isMobile) {
      setShowMobileThread(false);
    }
  };

  const handleLeaveThread = () => {
    // Refresh sidebar to remove the thread
    setSidebarRefreshTrigger(prev => prev + 1);
    // Also refresh posts in case blocking affected what's visible
    refreshPosts();
  };

  const handleNavigateToMyActivity = () => {
    console.log('Navigate to My Activity');
  };

  // Mobile tab handler
  const handleMobileTabChange = (tab: 'home' | 'messages' | 'activity' | 'menu') => {
    setMobileTab(tab);
    if (tab === 'messages') {
      setShowMobileMessages(true);
    } else {
      setShowMobileMessages(false);
    }
  };

  // Logged out view (no sidebar)
  if (!user) {
    return (
      <div className="app">
        <Header
          onLoginClick={() => setShowAuthModal(true)}
          user={user}
          onLogout={handleLogout}
        />
        <main className="main-content">
          <div className="guest-banner">
            <h1 className="page-title">Do things with people nearby</h1>
            <p className="page-subtitle">
              Browsing as a guest.{' '}
              <button
                className="text-link"
                onClick={() => setShowAuthModal(true)}
              >
                Log in
              </button>{' '}
              to post or respond.
            </p>
          </div>

          <div className="feed-header">
            <button className="btn btn-primary" onClick={handleShareClick}>
              Share what I'm doing
            </button>
            <select
              className="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="nearest">Sort by: nearest</option>
              <option value="soon">Sort by: happening soon</option>
              <option value="recent">Sort by: recently added</option>
            </select>
          </div>

          <LocationSection
            sortBy={sortBy}
            locationStatus={locationStatus}
            userLocation={userLocation}
            showLocationInput={showLocationInput}
            setShowLocationInput={setShowLocationInput}
            locationQuery={locationQuery}
            setLocationQuery={setLocationQuery}
            locationSuggestions={locationSuggestions}
            searchingLocation={searchingLocation}
            selectManualLocation={selectManualLocation}
            requestBrowserLocation={requestBrowserLocation}
          />

          {loading ? (
            <div className="loading-state">Loading...</div>
          ) : posts.length === 0 ? (
            <div className="empty-state">
              <p>Nothing nearby yet. Be the first to share what you're doing.</p>
              <button className="btn btn-primary" onClick={handleShareClick}>
                Share what I'm doing
              </button>
            </div>
          ) : (
            <div className="feed">
              {sortedPosts.map((post) => {
                const authorProfile = profiles[post.user_id];
                return (
                  <PostCard
                    key={post.id}
                    id={post.id}
                    title={post.title}
                    location={post.location}
                    latitude={post.latitude}
                    longitude={post.longitude}
                    time={post.time}
                    notes={post.notes || undefined}
                    name={post.name}
                    peopleInterested={post.people_interested}
                    preference={post.preference || undefined}
                    isLoggedIn={false}
                    onImInterested={() => handleInterestedClick(post)}
                    onReport={() => handleReportClick(post.id)}
                    distance={getPostDistance(post)}
                    authorAvatarUrl={authorProfile?.avatar_url}
                    authorDateOfBirth={authorProfile?.date_of_birth}
                  />
                );
              })}
            </div>
          )}
        </main>

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => setShowAuthModal(false)}
        />
      </div>
    );
  }

  // Logged in view (with fixed sidebars on desktop, bottom nav on mobile)
  return (
    <div style={{
      height: '100dvh',
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <Header
        onLoginClick={() => setShowAuthModal(true)}
        user={user}
        onLogout={handleLogout}
      />

      {/* Main layout */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'row',
        overflow: 'hidden',
      }}>
        {/* Left Sidebar - Desktop only */}
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
            selectedThreadId={selectedThreadId}
            onSelectThread={handleSelectThread}
            onNavigateToMyActivity={handleNavigateToMyActivity}
            onLogout={handleLogout}
            refreshTrigger={sidebarRefreshTrigger}
          />
        </div>

        {/* Feed - Scrollable, clickable to close thread */}
        <div 
          onClick={() => {
            if (selectedThreadId && !isMobile) {
              handleCloseThread();
            }
          }}
          style={{ 
            flex: 1, 
            overflowY: 'auto',
            opacity: selectedThreadId && !isMobile ? 0.4 : 1,
            pointerEvents: selectedThreadId && !isMobile ? 'auto' : 'auto',
            transition: 'opacity 0.2s ease',
            cursor: selectedThreadId && !isMobile ? 'pointer' : 'default',
            paddingBottom: isMobile ? 'calc(64px + env(safe-area-inset-bottom))' : '0',
          }}
        >
          <div 
            style={{ maxWidth: '600px', width: '100%', margin: '0 auto', padding: isMobile ? '16px' : '24px' }}
            onClick={(e) => {
              // Stop propagation when thread is not open so feed interactions work
              if (!selectedThreadId || isMobile) {
                e.stopPropagation();
              }
            }}
          >
             {/* Tagline */}
  <h1 style={{ 
    fontSize: '20px', 
    fontWeight: 600, 
    color: '#000',
    marginBottom: '16px',
  }}>
    Do things with people nearby
  </h1>
            <div 
              className="feed-header"
              onClick={(e) => e.stopPropagation()}
              style={{ pointerEvents: selectedThreadId && !isMobile ? 'none' : 'auto' }}
            >
              <button className="btn btn-primary" onClick={handleShareClick}>
                Share what I'm doing
              </button>
              <select
                className="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="nearest">Sort by: nearest</option>
                <option value="soon">Sort by: happening soon</option>
                <option value="recent">Sort by: recently added</option>
              </select>
            </div>

            <div onClick={(e) => e.stopPropagation()} style={{ pointerEvents: selectedThreadId && !isMobile ? 'none' : 'auto' }}>
              <LocationSection
                sortBy={sortBy}
                locationStatus={locationStatus}
                userLocation={userLocation}
                showLocationInput={showLocationInput}
                setShowLocationInput={setShowLocationInput}
                locationQuery={locationQuery}
                setLocationQuery={setLocationQuery}
                locationSuggestions={locationSuggestions}
                searchingLocation={searchingLocation}
                selectManualLocation={selectManualLocation}
                requestBrowserLocation={requestBrowserLocation}
              />
            </div>

            {loading ? (
              <div className="loading-state">Loading...</div>
            ) : sortedPosts.length === 0 ? (
              <div className="empty-state" onClick={(e) => e.stopPropagation()}>
                <p>Nothing nearby yet. Be the first to share what you're doing.</p>
                <button className="btn btn-primary" onClick={handleShareClick}>
                  Share what I'm doing
                </button>
              </div>
            ) : (
              <div className="feed" style={{ pointerEvents: selectedThreadId && !isMobile ? 'none' : 'auto' }}>
                {sortedPosts.map((post) => {
                  const authorProfile = profiles[post.user_id];
                  return (
                    <PostCard
                      key={post.id}
                      id={post.id}
                      title={post.title}
                      location={post.location}
                      latitude={post.latitude}
                      longitude={post.longitude}
                      time={post.time}
                      notes={post.notes || undefined}
                      name={post.name}
                      peopleInterested={post.people_interested}
                      preference={post.preference || undefined}
                      isLoggedIn={true}
                      onImInterested={() => handleInterestedClick(post)}
                      onReport={() => handleReportClick(post.id)}
                      distance={getPostDistance(post)}
                      authorAvatarUrl={authorProfile?.avatar_url}
                      authorDateOfBirth={authorProfile?.date_of_birth}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Message Thread - Desktop only */}
        {selectedThreadId && !isMobile && (
          <div 
            className="desktop-message-thread"
            style={{
              width: '384px',
              flexShrink: 0,
              borderLeft: '1px solid #f0f0f0',
              background: '#fff',
              overflow: 'hidden',
            }}
          >
            <MessageThread
              key={selectedThreadId}
              threadId={selectedThreadId}
              currentUserId={user.id}
              onClose={handleCloseThread}
              onReport={handleReportClick}
              onLeaveThread={handleLeaveThread}
            />
          </div>
        )}
      </div>

      {/* Mobile Bottom Nav */}
      {isMobile && (
        <BottomNav
          activeTab={mobileTab}
          onTabChange={handleMobileTabChange}
          messageCount={threadCount}
          onLogout={handleLogout}
          isAdmin={isAdmin}
          pendingPostsCount={pendingPostsCount}
          pendingReportsCount={pendingReportsCount}
        />
      )}

      {/* Mobile Message List */}
      {isMobile && showMobileMessages && (
        <MobileMessageList
          userId={user.id}
          onSelectThread={handleSelectThread}
          onClose={() => {
            setShowMobileMessages(false);
            setMobileTab('home');
          }}
          refreshTrigger={sidebarRefreshTrigger}
        />
      )}

      {/* Mobile Message Thread */}
      {isMobile && showMobileThread && selectedThreadId && (
        <div className="mobile-message-overlay open">
          <MessageThread
            key={selectedThreadId}
            threadId={selectedThreadId}
            currentUserId={user.id}
            onClose={() => {
              setShowMobileThread(false);
              setSelectedThreadId(null);
            }}
            onReport={handleReportClick}
            onLeaveThread={handleLeaveThread}
          />
        </div>
      )}

      {/* Modals */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => setShowAuthModal(false)}
      />

      <CreatePostModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handlePostCreated}
      />

      {showInterestedModal && selectedPost && (
        <InterestedModal
          post={selectedPost}
          currentUserId={user.id}
          onClose={() => {
            setShowInterestedModal(false);
            setSelectedPost(null);
          }}
          onSuccess={handleInterestedSuccess}
        />
      )}

      {showMessageSentModal && (
        <MessageSentModal
          onClose={handleMessageSentClose}
        />
      )}

      {showProfileCompletionModal && currentUserProfile && (
        <ProfileCompletionModal
          userId={user.id}
          userName={currentUserProfile.first_name}
          currentAvatarUrl={currentUserProfile.avatar_url}
          currentDateOfBirth={currentUserProfile.date_of_birth}
          onComplete={handleProfileComplete}
          onSkip={handleProfileSkip}
        />
      )}

      {showReportModal && reportPostId && (
        <ReportModal
          postId={reportPostId}
          threadId={reportThreadId || undefined}
          reportedBy={user.id}
          onClose={() => {
            setShowReportModal(false);
            setReportPostId(null);
            setReportThreadId(null);
          }}
          onSuccess={handleReportSuccess}
        />
      )}

      {showReportConfirmation && (
        <ReportConfirmationModal
          onClose={() => setShowReportConfirmation(false)}
        />
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div style={{ padding: '24px', textAlign: 'center' }}>Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}