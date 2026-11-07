'use client';

import { useEffect, useRef } from 'react';

// Mobile chat stack: the chat list underneath, the open thread on top, and an
// edge swipe (from the left 24px) that drags the thread away to go back.
//
// The list is always rendered in the same place in the tree, so it stays
// mounted (and keeps its data) while a thread is open on top of it. While a
// thread is open the list layer is hidden and only made visible during a
// swipe, so it costs nothing to paint the rest of the time.
//
// The drag never touches React state: positions are written straight to the
// two layers' styles inside requestAnimationFrame, so a swipe doesn't
// re-render the thread on every frame.

const EDGE_PX = 24;
const LOCK_PX = 8; // movement before deciding horizontal vs vertical
const CLOSE_FRACTION = 0.35;
const FLICK_PX_PER_MS = 0.5;
const PARALLAX = 0.3;
const DIM_OPACITY = 0.12;
const SETTLE_MS = 250;
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

interface SwipeBackContainerProps {
  // True while a thread is showing on top of the list.
  threadOpen: boolean;
  list: React.ReactNode;
  thread: React.ReactNode;
  // Called after a swipe has carried the thread off-screen.
  onSwipeClose: () => void;
}

type Phase = 'idle' | 'pending' | 'dragging' | 'settling';

function swipeBlocked(): boolean {
  // The reactions long-press tray is open
  if (document.querySelector('[data-reaction-tray]')) return true;
  // Selecting text in the message box
  const active = document.activeElement;
  if (active instanceof HTMLTextAreaElement && active.selectionStart !== active.selectionEnd) return true;
  return false;
}

export default function SwipeBackContainer({ threadOpen, list, thread, onSwipeClose }: SwipeBackContainerProps) {
  const threadRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const onSwipeCloseRef = useRef(onSwipeClose);

  useEffect(() => {
    onSwipeCloseRef.current = onSwipeClose;
  }, [onSwipeClose]);

  useEffect(() => {
    const top = threadRef.current;
    if (!threadOpen || !top) return;

    let phase: Phase = 'idle';
    let startX = 0;
    let startY = 0;
    let dx = 0;
    // Last two samples, for release velocity
    let prev = { x: 0, t: 0 };
    let last = { x: 0, t: 0 };
    let frame = 0;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    const width = () => top.getBoundingClientRect().width || window.innerWidth;

    const paint = (offset: number, animate: boolean) => {
      const under = listRef.current;
      const dim = dimRef.current;
      const progress = Math.min(Math.max(offset / width(), 0), 1);
      const transition = animate ? `transform ${SETTLE_MS}ms ${EASE}` : 'none';
      top.style.transition = transition;
      top.style.transform = `translateX(${offset}px)`;
      if (under) {
        under.style.transition = transition;
        under.style.transform = `translateX(${-PARALLAX * 100 * (1 - progress)}%)`;
      }
      if (dim) {
        dim.style.transition = animate ? `opacity ${SETTLE_MS}ms ${EASE}` : 'none';
        dim.style.opacity = String(1 - progress);
      }
    };

    const showUnder = (show: boolean) => {
      const under = listRef.current;
      if (under) under.style.visibility = show ? 'visible' : 'hidden';
      top.style.willChange = show ? 'transform' : '';
      if (under) under.style.willChange = show ? 'transform' : '';
    };

    // Back to rest: no transform left on the thread, so fixed-position
    // children (modals, the reactions tray) position against the viewport.
    const reset = () => {
      top.style.transition = '';
      top.style.transform = '';
      showUnder(false);
      phase = 'idle';
    };

    const onTouchStart = (e: TouchEvent) => {
      if (phase !== 'idle' || e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX > EDGE_PX || swipeBlocked()) return;
      phase = 'pending';
      startX = t.clientX;
      startY = t.clientY;
      dx = 0;
      prev = last = { x: t.clientX, t: e.timeStamp };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (phase !== 'pending' && phase !== 'dragging') return;
      const t = e.touches[0];
      const moveX = t.clientX - startX;
      const moveY = t.clientY - startY;

      if (phase === 'pending') {
        if (Math.abs(moveX) < LOCK_PX && Math.abs(moveY) < LOCK_PX) return;
        // Mostly vertical, or leftward: leave it to scrolling
        if (Math.abs(moveY) > Math.abs(moveX) || moveX <= 0) {
          phase = 'idle';
          return;
        }
        phase = 'dragging';
        showUnder(true);
      }

      // Horizontal drag owns the gesture now; stop the page scrolling under it
      e.preventDefault();
      dx = Math.max(0, moveX);
      prev = last;
      last = { x: t.clientX, t: e.timeStamp };
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          paint(dx, false);
        });
      }
    };

    const settle = (close: boolean) => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      phase = 'settling';
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const finish = () => {
        settleTimer = null;
        if (close) {
          onSwipeCloseRef.current();
          // The thread unmounts on close; reset in case it doesn't
          phase = 'idle';
        } else {
          reset();
        }
      };
      if (reduced) {
        if (close) paint(width(), false);
        finish();
        return;
      }
      paint(close ? width() : 0, true);
      settleTimer = setTimeout(finish, SETTLE_MS);
    };

    const onTouchEnd = () => {
      if (phase === 'pending') {
        phase = 'idle';
        return;
      }
      if (phase !== 'dragging') return;
      const dt = last.t - prev.t;
      const velocity = dt > 0 ? (last.x - prev.x) / dt : 0;
      settle(dx > width() * CLOSE_FRACTION || velocity > FLICK_PX_PER_MS);
    };

    const onTouchCancel = () => {
      if (phase === 'dragging') settle(false);
      else if (phase === 'pending') phase = 'idle';
    };

    top.addEventListener('touchstart', onTouchStart, { passive: true });
    top.addEventListener('touchmove', onTouchMove, { passive: false });
    top.addEventListener('touchend', onTouchEnd, { passive: true });
    top.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      top.removeEventListener('touchstart', onTouchStart);
      top.removeEventListener('touchmove', onTouchMove);
      top.removeEventListener('touchend', onTouchEnd);
      top.removeEventListener('touchcancel', onTouchCancel);
      if (frame) cancelAnimationFrame(frame);
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, [threadOpen]);

  return (
    <>
      {/* List layer. With no thread open it is just the list as before. */}
      <div
        ref={listRef}
        style={threadOpen ? {
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          background: 'var(--bg-badge)',
          overflow: 'hidden',
          visibility: 'hidden',
          transform: `translateX(${-PARALLAX * 100}%)`,
        } : undefined}
      >
        {list}
        {threadOpen && (
          <div
            ref={dimRef}
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 46,
              background: `rgba(0, 0, 0, ${DIM_OPACITY})`,
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
      {threadOpen && (
        <div ref={threadRef} className="mobile-message-overlay open">
          {thread}
        </div>
      )}
    </>
  );
}
