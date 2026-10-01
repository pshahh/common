'use client';

import { useEffect, useRef, useState } from 'react';

// Fixed set -- must match the CHECK constraint on message_reactions.emoji.
// The heart is U+2764 U+FE0F (emoji presentation), not the bare U+2764.
export const REACTION_EMOJI = ['👍', '❤️', '😂', '😮', '🙏'] as const;

export interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

const LONG_PRESS_MS = 350;
const LONG_PRESS_MOVE_TOLERANCE = 8;
const TRAY_HEIGHT = 48;
const TRAY_WIDTH = 296;

function useIsTouch(): boolean {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(hover: none)');
    const update = () => setIsTouch(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return isTouch;
}

interface ReactableBubbleProps {
  align: 'left' | 'right';
  // Plain text of the message, for the tray's Copy action.
  text: string;
  // Only other people's user messages can be reacted to.
  canReact: boolean;
  reactions: Reaction[];
  currentUserId: string;
  isGroup: boolean;
  nameFor: (userId: string) => string;
  onReact: (emoji: string) => void;
  children: React.ReactNode;
}

export default function ReactableBubble({
  align,
  text,
  canReact,
  reactions,
  currentUserId,
  isGroup,
  nameFor,
  onReact,
  children,
}: ReactableBubbleProps) {
  const isTouch = useIsTouch();
  const rootRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [trayPos, setTrayPos] = useState<{ top: number; left: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [whoEmoji, setWhoEmoji] = useState<string | null>(null);

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);

  const myReaction = reactions.find((r) => r.user_id === currentUserId)?.emoji ?? null;

  const clearPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
    pressStart.current = null;
  };

  useEffect(() => clearPress, []);

  const openTray = () => {
    const el = bubbleRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const width = Math.min(TRAY_WIDTH, vw - 16);
    let left = align === 'right' ? rect.right - width : rect.left;
    left = Math.max(8, Math.min(left, vw - width - 8));
    // Prefer above the bubble; flip below if there's no room at the top.
    let top = rect.top - TRAY_HEIGHT - 6;
    if (top < 8) top = rect.bottom + 6;
    setTrayPos({ top, left });
  };

  const closeTray = () => {
    setTrayPos(null);
    setCopied(false);
  };

  // Dismiss tray / who-list on outside press, Escape, or scroll.
  useEffect(() => {
    if (!trayPos && !whoEmoji) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      closeTray();
      setWhoEmoji(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeTray();
        setWhoEmoji(null);
      }
    };
    const onScroll = () => {
      closeTray();
      setWhoEmoji(null);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [trayPos, whoEmoji]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    // Leave link taps alone.
    if ((e.target as HTMLElement).closest('a')) return;
    clearPress();
    pressStart.current = { x: e.clientX, y: e.clientY };
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null;
      // Beat the OS word-selection that a long press would otherwise start.
      window.getSelection()?.removeAllRanges();
      openTray();
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const start = pressStart.current;
    if (!start) return;
    if (
      Math.abs(e.clientX - start.x) > LONG_PRESS_MOVE_TOLERANCE ||
      Math.abs(e.clientY - start.y) > LONG_PRESS_MOVE_TOLERANCE
    ) {
      clearPress();
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(closeTray, 900);
    } catch (err) {
      console.error('Copy failed:', err);
      closeTray();
    }
  };

  const pick = (emoji: string) => {
    closeTray();
    onReact(emoji);
  };

  // Group reactions by emoji, in the fixed order.
  const grouped = REACTION_EMOJI.map((emoji) => ({
    emoji,
    users: reactions.filter((r) => r.emoji === emoji).map((r) => r.user_id),
  })).filter((g) => g.users.length > 0);

  const hoverButtonVisible = canReact && !isTouch && (hovered || !!trayPos);

  return (
    <div
      ref={rootRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'right' ? 'flex-end' : 'flex-start',
        paddingBottom: grouped.length > 0 ? '4px' : 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexDirection: align === 'right' ? 'row-reverse' : 'row' }}>
        <div
          ref={bubbleRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={clearPress}
          onPointerCancel={clearPress}
          onPointerLeave={clearPress}
          onContextMenu={(e) => {
            if (isTouch) e.preventDefault();
          }}
          style={
            isTouch
              ? { userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }
              : undefined
          }
        >
          {children}
        </div>
        {canReact && !isTouch && (
          <button
            type="button"
            aria-label="Add reaction"
            onClick={() => (trayPos ? closeTray() : openTray())}
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              flexShrink: 0,
              opacity: hoverButtonVisible ? 1 : 0,
              pointerEvents: hoverButtonVisible ? 'auto' : 'none',
              transition: 'opacity 0.12s ease',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9.5" x2="9.01" y2="9.5" />
              <line x1="15" y1="9.5" x2="15.01" y2="9.5" />
            </svg>
          </button>
        )}
      </div>

      {grouped.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '4px',
            marginTop: '-8px',
            marginLeft: align === 'left' ? '4px' : 0,
            marginRight: align === 'right' ? '4px' : 0,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {grouped.map(({ emoji, users }) => {
            const mine = users.includes(currentUserId);
            return (
              <button
                key={emoji}
                type="button"
                onClick={isGroup ? () => setWhoEmoji(whoEmoji === emoji ? null : emoji) : undefined}
                aria-label={`${emoji}${users.length > 1 ? ` ${users.length}` : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '1px 6px',
                  fontSize: '12px',
                  lineHeight: '16px',
                  borderRadius: '10px',
                  background: 'var(--pill-fill)',
                  // Same 1px border everywhere keeps all pills one size; only
                  // my reactions in group threads swap it for the accent.
                  border: `1px solid ${isGroup && mine ? 'var(--accent)' : 'var(--pill-fill)'}`,
                  // Ring in the thread background so pills look cut out of the bubble.
                  boxShadow: '0 0 0 2px var(--bg-badge)',
                  color: 'var(--text-secondary)',
                  cursor: isGroup ? 'pointer' : 'default',
                }}
              >
                <span>{emoji}</span>
                {users.length > 1 && <span>{users.length}</span>}
              </button>
            );
          })}
        </div>
      )}

      {isGroup && whoEmoji && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            [align === 'right' ? 'right' : 'left']: '8px',
            marginTop: '2px',
            zIndex: 20,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            padding: '8px 12px',
            fontSize: '12px',
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ marginRight: '6px' }}>{whoEmoji}</span>
          {grouped
            .find((g) => g.emoji === whoEmoji)
            ?.users.map((id) => nameFor(id))
            .join(', ')}
        </div>
      )}

      {trayPos && (
        <div
          role="menu"
          style={{
            position: 'fixed',
            top: trayPos.top,
            left: trayPos.left,
            zIndex: 60,
            height: `${TRAY_HEIGHT}px`,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            padding: '0 6px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '24px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          }}
        >
          {canReact &&
            REACTION_EMOJI.map((emoji) => (
              <button
                key={emoji}
                type="button"
                role="menuitem"
                aria-label={`React ${emoji}`}
                onClick={() => pick(emoji)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  border: 'none',
                  background: myReaction === emoji ? 'var(--bg-badge)' : 'transparent',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {emoji}
              </button>
            ))}
          <button
            type="button"
            role="menuitem"
            onClick={handleCopy}
            style={{
              height: '36px',
              padding: '0 10px',
              borderRadius: '18px',
              border: 'none',
              background: 'transparent',
              fontSize: '13px',
              color: copied ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              marginLeft: canReact ? '2px' : 0,
              borderLeft: canReact ? '1px solid var(--border)' : 'none',
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  );
}
