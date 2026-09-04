interface FeaturedLabelProps {
  label?: string;
  showIcon?: boolean;
}

// Sits above a card, outside its border - "the feed is speaking", not a
// claim the poster made. Reused wherever a post is placed for editorial
// reasons rather than earning its spot algorithmically.
export default function FeaturedLabel({ label = 'Featured', showIcon = true }: FeaturedLabelProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.09em',
        textTransform: 'uppercase',
        color: 'var(--text-secondary)',
        padding: '0 0 7px 4px',
      }}
    >
      {showIcon && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.75, flexShrink: 0 }}>
          <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.9-6.2 3.9 1.6-7L2 9.2l7.1-.6z" />
        </svg>
      )}
      {label}
    </div>
  );
}
