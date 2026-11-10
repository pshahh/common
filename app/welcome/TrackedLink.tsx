'use client';

import Link from 'next/link';
import posthog from 'posthog-js';
import type { ComponentProps } from 'react';

type Props = ComponentProps<typeof Link> & {
  /** Which CTA this is, e.g. "hero_see_whats_on". Sent as `cta` on `landing_cta_clicked`. */
  cta: string;
};

/**
 * A Next.js Link that records `landing_cta_clicked` before navigating.
 * Same conventions as the existing events: cookieless, no PII, just the CTA name.
 * If posthog isn't initialised (local dev), capture is a no-op.
 */
export default function TrackedLink({ cta, onClick, ...rest }: Props) {
  return (
    <Link
      {...rest}
      onClick={(e) => {
        try {
          posthog.capture('landing_cta_clicked', { cta });
        } catch {
          /* analytics must never block navigation */
        }
        onClick?.(e);
      }}
    />
  );
}
