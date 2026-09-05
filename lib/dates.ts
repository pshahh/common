// Formats next_occurrence_at for display. Matches the format CreatePostModal
// writes into the free-text `time` field ("Sunday 6 September"), so a listing's
// next date reads the same as the date on a one-off post.
//
// Returns null for a missing or unparseable value, which is the common case
// until the recurring backfill runs - callers render nothing at all rather
// than reserving space. See docs/recurring-posts-and-boosting.md.
export function formatNextOccurrence(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

// The single date a listing should display.
//
// A recurring listing carries a rolling next_occurrence_at, but its free-text
// `time` column still says whatever the host typed months ago ("Sunday 5 July,
// 9:00am to 11:00am"). Showing both produced two dates on one card, one of them
// wrong. This substitutes the real date for the stale one while keeping the
// host's time of day, in the normal time-field position:
//
//   "Friday 15 May, 14:00 -16:00"  +  2026-09-11  ->  "Friday 11 September, 14:00 -16:00"
//
// Split on the FIRST comma. The old generate_recurring_posts required two or
// more commas and took the third chunk, which never matched real data - every
// live post has exactly one comma - so it silently dropped the time of day.
//
// This is a RENDER-time transformation. The stored `time` column is never
// rewritten: the old recurrence job did that and permanently destroyed the
// host's original wording.
//
// Standing offers have no next_occurrence_at ("Friday evenings", "Weekends")
// and are returned untouched.
export function formatListingTime(
  time: string,
  nextOccurrenceAt: string | null | undefined
): string {
  const nextOccurrence = formatNextOccurrence(nextOccurrenceAt);
  if (!nextOccurrence) return time;

  const commaIndex = time.indexOf(',');
  if (commaIndex === -1) return nextOccurrence;

  const timeOfDay = time.slice(commaIndex + 1).trim();
  return timeOfDay ? `${nextOccurrence}, ${timeOfDay}` : nextOccurrence;
}
