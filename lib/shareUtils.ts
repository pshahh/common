'use client';

/**
 * Whether this device should get the OS-level native share sheet.
 *
 * We deliberately don't just feature-detect `navigator.share` — desktop
 * Safari and Chrome on macOS support the Web Share API too, so a plain
 * feature check pops the OS share sheet on desktop web as well. That's
 * jarring next to common's calm, non-performative brand (see product
 * philosophy: no urgency, no OS chrome hijacking the screen).
 *
 * Native share sheets are reserved for touch devices — real phones, and
 * the Capacitor WebView on iOS/Android — where they're genuinely useful
 * (hand a link straight to Messages/WhatsApp to invite someone). On
 * desktop we always fall back to a quiet clipboard copy + inline
 * "✓ Copied!" confirmation instead.
 */
export function canUseNativeShare(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  if (typeof window === 'undefined') return false;

  const isTouchDevice =
    (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) ||
    navigator.maxTouchPoints > 0;

  return isTouchDevice;
}

/**
 * Copy text to the clipboard, with a fallback for contexts where the
 * async Clipboard API isn't available (older browsers, non-HTTPS).
 */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
}

/**
 * Share a link: native share sheet on touch devices, clipboard copy
 * everywhere else.
 *
 * Returns `true` if the link was copied to the clipboard (so the caller
 * should show its own "Copied!" confirmation), or `false` if the native
 * share sheet was used instead (which has its own OS-level feedback, so
 * no additional confirmation is needed).
 */
export async function shareOrCopyLink(url: string, title?: string): Promise<boolean> {
  if (canUseNativeShare()) {
    try {
      await navigator.share({ title, url });
    } catch {
      // User cancelled the share sheet, or it failed - nothing to do.
    }
    return false;
  }

  await copyText(url);
  return true;
}
