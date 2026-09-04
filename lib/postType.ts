export type PostType = 'standing_offer' | 'one_off' | 'recurring';

// 'standing_offer' isn't derivable yet - it needs the next_occurrence_at
// column from the recurring-posts change, which hasn't shipped (see
// docs/recurring-posts-and-boosting.md). Until then every repeating post
// reports as 'recurring'.
export function getPostType(recurrenceRule: string | null): PostType {
  return recurrenceRule ? 'recurring' : 'one_off';
}
