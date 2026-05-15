'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { renderTextWithLinks } from '@/lib/textUtils';

interface Post {
  id: string;
  title: string;
  location: string;
  time: string;
  notes: string | null;
  name: string;
  user_id: string;
  preference?: string | null;
  thread_type?: string | null;
}

interface InterestedModalProps {
  post: Post;
  currentUserId: string;
  onClose: () => void;
  onSuccess: (threadId: string, messageSent: boolean) => void;
}

export default function InterestedModal({
  post,
  currentUserId,
  onClose,
  onSuccess,
}: InterestedModalProps) {
  const [message, setMessage] = useState('hey, I\'d be up for joining this');
  const [sending, setSending] = useState(false);

  const isGroup = post.thread_type === 'group';

  const handleGroupJoin = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.rpc('join_group_thread', {
        post_id_param: post.id,
      });

      if (error) throw error;

      const threadId = data.thread_id;

      // Mark as read so joiner doesn't see unread dot for their own join
      await supabase.rpc('mark_thread_read', { thread_id_param: threadId });

      onSuccess(threadId, true);
    } catch (error) {
      console.error('Error joining group:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const createThreadAndMessage = async () => {
    setSending(true);
    try {
      // Check if thread already exists
      const { data: existingThreads, error: threadCheckError } = await supabase
        .from('threads')
        .select('id')
        .eq('post_id', post.id)
        .contains('participant_ids', [currentUserId]);

      if (threadCheckError) throw threadCheckError;

      let threadId: string;

      if (existingThreads && existingThreads.length > 0) {
        // Thread exists, use it
        threadId = existingThreads[0].id;
      } else {
        // Create new thread
        const { data: newThread, error: threadError } = await supabase
          .from('threads')
          .insert({
            post_id: post.id,
            participant_ids: [currentUserId, post.user_id],
            created_by: currentUserId,
          })
          .select()
          .single();

        if (threadError) throw threadError;
        threadId = newThread.id;

        // Increment people_interested count on the post
        await supabase.rpc('increment_interested', { post_id: post.id });
      }

      // Send the message (use default if field is empty)
      const messageContent = message.trim() || 'hey, I\'d be up for joining this';
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          thread_id: threadId,
          sender_id: currentUserId,
          content: messageContent,
        });

      if (messageError) throw messageError;

      // After the message insert succeeds, mark the thread as read
      // so the sender doesn't see an unread dot for their own message
      await supabase.rpc('mark_thread_read', { thread_id_param: threadId });

      onSuccess(threadId, true);
    } catch (error) {
      console.error('Error creating thread:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{isGroup ? 'Join the group' : 'Say hello'}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          {/* Post summary card */}
          <div className="post-summary">
            <h4 className="post-summary-title">{post.title}</h4>
            <p className="post-summary-meta">
              {post.location} · {post.time}
            </p>
            {post.notes && (
              <p className="post-summary-notes" style={{ whiteSpace: 'pre-line' }}>{renderTextWithLinks(post.notes)}</p>
            )}
            {post.preference && post.preference !== 'Anyone' && (
              <span className="preference-badge small">{post.preference}</span>
            )}
            <div className="post-summary-footer">
              <span className="post-summary-name">{post.name}</span>
            </div>
          </div>

          {isGroup ? (
            <>
              {/* Group join — no message required */}
              <p style={{ fontSize: '14px', color: '#444', lineHeight: 1.5 }}>
                You&apos;ll land in the group chat. Say hello.
              </p>
              {/* Safety tips */}
              <div className="safety-tips">
                <p>Meet in public places</p>
                <p>Decide details together</p>
                <p>You&apos;re free to leave at any time</p>
              </div>
              {/* Actions */}
              <div className="modal-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleGroupJoin}
                  disabled={sending}
                >
                  {sending ? 'Joining...' : 'Join group'}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* 1:1 flow — existing behaviour */}
              <div className="form-group">
                <label className="form-label">
                  Drop them a message
                </label>
                <p style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
                  A little intro goes a long way
                </p>
                <textarea
                  className="form-textarea"
                  placeholder="hey, I'd be up for joining this"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                />
              </div>
              {/* Safety tips */}
              <div className="safety-tips">
                <p>Meet somewhere public</p>
                <p>Decide details together</p>
                <p>Leave when you feel like it</p>
              </div>
              {/* Actions */}
              <div className="modal-actions">
                <button
                  className="btn btn-primary"
                  onClick={createThreadAndMessage}
                  disabled={sending}
                >
                  {sending ? 'Sending...' : 'Send & join'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}