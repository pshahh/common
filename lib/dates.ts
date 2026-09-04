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
