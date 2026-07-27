'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { shareOrCopyLink } from '@/lib/shareUtils';

interface UseShareInviteOptions {
  userId: string | undefined;
}

interface UseShareInviteReturn {
  shareUrl: string | null;
  showModal: boolean;
  justCopied: boolean;
  handleShareClick: () => Promise<void>;
  closeModal: () => void;
}

export function useShareInvite({ userId }: UseShareInviteOptions): UseShareInviteReturn {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [justCopied, setJustCopied] = useState(false);

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
      // Skip preview — go straight to native share (touch devices) or a
      // quiet clipboard copy with inline "✓ Copied!" feedback (desktop web),
      // matching the share behaviour on post cards.
      const didCopy = await shareOrCopyLink(url, 'Be friends on common');
      if (didCopy) {
        setJustCopied(true);
        setTimeout(() => setJustCopied(false), 2000);
      }
    } else {
      // First time — show the preview modal
      setShowModal(true);
    }
  }, [userId]);

  const closeModal = useCallback(() => {
    setShowModal(false);
  }, []);

  return { shareUrl, showModal, justCopied, handleShareClick, closeModal };
}
