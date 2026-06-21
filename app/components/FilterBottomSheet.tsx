'use client';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  options: FilterOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
}

export default function FilterBottomSheet({
  isOpen,
  onClose,
  title,
  options,
  selectedValue,
  onSelect,
}: FilterBottomSheetProps) {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(4px)',
        zIndex: 70,
        display: 'flex',
        alignItems: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          background: 'var(--bg)',
          borderRadius: '16px 16px 0 0',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px 12px',
          borderBottom: '1px solid var(--border-light)',
        }}>
          <span style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}>
            {title}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '16px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            X
          </button>
        </div>

        {/* Options */}
        <div style={{ padding: '8px 0' }}>
          {options.map((option) => {
            const isSelected = option.value === selectedValue;
            return (
              <button
                key={option.value}
                onClick={() => {
                  onSelect(option.value);
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '14px 24px',
                  background: isSelected ? 'var(--bg-subtle)' : 'transparent',
                  border: 'none',
                  fontSize: '15px',
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: isSelected ? (600 as const) : (400 as const),
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left' as const,
                  transition: 'background 0.1s ease',
                }}
              >
                <span>{option.label}</span>
                {isSelected && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}