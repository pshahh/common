'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Post {
  id: string;
  title: string;
  location: string;
  time: string;
  notes?: string | null;
  preference?: string | null;
  name: string;
  user_id: string;
}

interface InterestedModalProps {
  post: Post;
  currentUserId: string;
  onClose: () => void;
  onSuccess: (threadId: string) => void;
}

export default function InterestedModal({
  post,
  currentUserId,
  onClose,
  onSuccess,
}: InterestedModalProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showSkipTooltip, setShowSkipTooltip] = useState(false);

  const createThreadAndMessage = async (includeMessage: boolean) => {
    setSending(true);

    try {
      // Check if a thread already exists for this user and post
      const { data: existingThread } = await supabase
        .from('threads')
        .select('id')
        .eq('post_id', post.id)
        .contains('participant_ids', [currentUserId])
        .single();

      let threadId: string;

      if (existingThread) {
        threadId = existingThread.id;
      } else {
        // Create the thread
        const { data: newThread, error: threadError } = await supabase
          .from('threads')
          .insert({
            post_id: post.id,
            participant_ids: [post.user_id, currentUserId],
            created_by: currentUserId,
          })
          .select('id')
          .single();

        if (threadError) throw threadError;
        threadId = newThread.id;

        // Increment people_interested count on the post
        await supabase.rpc('increment_interested', { post_id: post.id });
      }

      // Send the message if provided
      if (includeMessage && message.trim()) {
        const { error: messageError } = await supabase
          .from('messages')
          .insert({
            thread_id: threadId,
            sender_id: currentUserId,
            content: message.trim(),
          });

        if (messageError) throw messageError;
      }

      onSuccess(threadId);
    } catch (error) {
      console.error('Error creating thread:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Send a message to coordinate</h2>
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
              <p className="post-summary-notes">{post.notes}</p>
            )}
            {post.preference && post.preference !== 'Anyone' && (
              <span className="preference-badge small">{post.preference}</span>
            )}
            <div className="post-summary-footer">
              <span className="post-summary-name">{post.name}</span>
            </div>
          </div>

          {/* Message input */}
          <div className="form-group">
            <label className="form-label">
              A quick (optional) note to get things moving
            </label>
            <textarea
              className="form-textarea"
              placeholder="Hey, I'm interested in joining you. How should we do this?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>

          <p className="hint-text">
            Once you've both sent a message, you'll see each other's profile photo.
          </p>

          {/* Safety tips */}
          <div className="safety-tips">
            <p>Meet in public places</p>
            <p>Decide details together</p>
            <p>You're free to leave at any time</p>
          </div>

          {/* Actions */}
          <div className="modal-actions">
            <div className="skip-button-container">
              <button
                className="btn btn-secondary"
                onClick={() => createThreadAndMessage(false)}
                disabled={sending}
                onMouseEnter={() => setShowSkipTooltip(true)}
                onMouseLeave={() => setShowSkipTooltip(false)}
              >
                Send later
              </button>
              {showSkipTooltip && (
                <div className="skip-tooltip">
                  You'll be able to send a message later on
                </div>
              )}
            </div>
            <button
              className="btn btn-primary"
              onClick={() => createThreadAndMessage(true)}
              disabled={sending}
            >
              {sending ? 'Sending...' : 'Send message'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}