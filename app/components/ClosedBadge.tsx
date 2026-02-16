'use client';

import { useState, useRef, useEffect } from 'react';

interface ClosedBadgeProps {
  size?: 'small' | 'normal';
}

export default function ClosedBadge({ size = 'normal' }: ClosedBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const badgeRef = useRef<HTMLSpanElement>(null);

  const isSmall = size === 'small';

  useEffect(() => {
    if (showTooltip && badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect();
      setTooltipPosition({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
    }
  }, [showTooltip]);

  return (
    <>
      <span
        ref={badgeRef}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: isSmall ? '11px' : '12px',
          fontWeight: 500,
          color: '#666',
          background: '#f0f0f0',
          border: '1px solid #e0e0e0',
          padding: isSmall ? '2px 8px' : '4px 10px',
          borderRadius: '12px',
          cursor: 'help',
        }}
      >
        Closed
      </span>
      
      {showTooltip && (
        <div
          style={{
            position: 'fixed',
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            transform: 'translate(-50%, -100%)',
            padding: '8px 12px',
            background: '#333',
            color: '#fff',
            fontSize: '12px',
            borderRadius: '8px',
            whiteSpace: 'nowrap',
            zIndex: 9999,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            pointerEvents: 'none',
          }}
        >
          No longer looking for more people
          {/* Arrow */}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid #333',
            }}
          />
        </div>
      )}
    </>
  );
}