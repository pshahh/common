import React from 'react';

export function renderTextWithLinks(text: string) {
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
          style={{ color: '#444', textDecoration: 'underline' }}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}