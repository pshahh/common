'use client';

interface PostCardProps {
  title: string;
  location: string;
  time: string;
  notes?: string;
  name: string;
  peopleIn?: number;
  preference?: string;
}

export default function PostCard({ 
  title, 
  location, 
  time, 
  notes, 
  name, 
  peopleIn = 0,
  preference 
}: PostCardProps) {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontWeight: 600, fontSize: '16px', marginBottom: '6px' }}>{title}</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>{location}</span>
            <span style={{ margin: '0 8px' }}>·</span>
            <span>{time}</span>
          </p>
          {notes && (
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              {notes}
            </p>
          )}
          {preference && (
            <span className="badge-preference" style={{ display: 'inline-block', marginBottom: '12px' }}>
              {preference}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '12px' }}>
          <span>Share</span>
          <span>↗</span>
        </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn-primary">
            I'm interested
          </button>
          {peopleIn > 0 && (
            <span className="badge-interested">
              {peopleIn} interested
            </span>
          )}
        </div>
        <span style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>{name}</span>
      </div>
    </div>
  );
}