'use client';

import { useEffect } from 'react';

/**
 * Fades sections up as they scroll into view. Anything marked [data-reveal]
 * that is already on screen when the page loads is left alone, so nothing
 * above the fold blinks out and back in. Without JS, or with reduced motion
 * turned on, everything simply shows.
 */
export default function Reveal() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;

    const below = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]')).filter(
      (el) => el.getBoundingClientRect().top > window.innerHeight * 0.92,
    );
    below.forEach((el) => el.setAttribute('data-reveal', 'pending'));

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute('data-reveal', 'shown');
          io.unobserve(entry.target);
        }
      },
      // Wide side margins so cards in the phone carousel reveal with their row,
      // not one by one as they're swiped in.
      { rootMargin: '0px 100% -8% 100%', threshold: 0.12 },
    );
    below.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}
