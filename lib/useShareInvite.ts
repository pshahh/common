'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface UseShareInviteOptions {
  userId: string | undefined;
}

interface UseShareInviteReturn {
  shareUrl: string | null;
  showModal: boolean;
  handleShareClick: () => Promise<void>;
  closeModal: () => void;
}

export function useShareInvite({ userId }: UseShareInviteOptions): UseShareInviteReturn {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  async function copyToClipboard(text: string): Promise<boolean> {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for mobile / non-HTTPS
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      document.body.removeChild(textarea);
      return false;
    }
  }

  const handleShareClick = useCallback(async () => {
    if (!userId) return;

    // Fetch the user's connect slug
    const { data: profile } = await supabase
      .from('profiles')
      .select('connect_slug')
      .eq('id', userId)
      .single();

    if (!profile?.connect_slug) return;

    const url = `${window.location.origin}/connect/${profile.connect_slug}`;
    setShareUrl(url);

    const hasSharedBefore = localStorage.getItem('common_has_shared_invite') === 'true';

    if (hasSharedBefore) {
      // Skip preview — go straight to share/copy
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Be friends on common',
            url,
          });
        } catch (e) {
          // User cancelled
        }
      } else {
        await copyToClipboard(url);
        // You could trigger a toast here
      }
    } else {
      // First time — show the preview modal
      setShowModal(true);
    }
  }, [userId]);

  const closeModal = useCallback(() => {
    setShowModal(false);
  }, []);

  return { shareUrl, showModal, handleShareClick, closeModal };
}