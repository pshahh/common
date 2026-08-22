import React from 'react';

export function renderTextWithLinks(text: string, linkColor?: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          title={part}
          style={{
            color: linkColor || '#444',
            textDecoration: 'underline',
            // Long unbroken URLs wrapped mid-word (even with break-word)
            // tend to strand a single character on its own line. Truncating
            // to one line with an ellipsis avoids that without needing a
            // wider container or smaller text - the full URL is still the
            // href and shows on hover via the title attribute.
            display: 'inline-block',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            verticalAlign: 'bottom',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}