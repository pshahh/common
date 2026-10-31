'use client';

export interface BlockCandidate {
  id: string;
  firstName: string;
}

interface BlockMemberPickerProps {
  people: BlockCandidate[] | null;
  onCancel: () => void;
  onSelect: (person: BlockCandidate) => void;
}

// First step of blocking from a group conversation: choose who to block.
// The choice then goes to BlockUserModal for confirmation.
export default function BlockMemberPicker({ people, onCancel, onSelect }: BlockMemberPickerProps) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--bg-card)', borderRadius: '16px', padding: '24px',
        maxWidth: '340px', width: '100%', margin: '0 16px',
      }}>
        <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
          Who do you want to block?
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '20px', maxHeight: '50vh', overflowY: 'auto' }}>
          {people === null ? (
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', padding: '12px 0' }}>Loading...</div>
          ) : people.map((person) => (
            <button
              key={person.id}
              onClick={() => onSelect(person)}
              style={{
                padding: '12px 0', fontSize: '14px', textAlign: 'left',
                border: 'none', borderBottom: '1px solid var(--border)', background: 'none',
                cursor: 'pointer', color: 'var(--text-primary)',
              }}
            >
              {person.firstName}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px', borderRadius: '20px', fontSize: '14px',
              fontWeight: 500, border: '1px solid var(--border)', background: 'var(--bg-card)',
              cursor: 'pointer', color: 'var(--text-primary)',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
