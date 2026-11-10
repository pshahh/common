import { createClient } from '@supabase/supabase-js';
import { formatListingTime } from '@/lib/dates';

/**
 * Public, read-only data for the /welcome landing page.
 * Uses the anon key, so RLS decides what's visible, exactly as it does for the
 * logged-out feed. Friends-only, archived children and expired posts are excluded.
 */

export type LivePost = {
  id: string;
  href: string;
  title: string;
  area: string;
  when: string;
  repeats: string | null;
  host: string;
  interested: number;
};

type PostRow = {
  id: string;
  slug: string | null;
  title: string | null;
  location: string | null;
  time: string | null;
  name: string | null;
  people_interested: number | null;
  recurrence_rule: string | null;
  expires_at: string | null;
  next_occurrence_at: string | null;
};

const STANDING_OFFER_EXPIRY = '2099-01-01';

const supabase = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const NOISE = /^(greater london|england|united kingdom|london borough of .*|royal borough of .*|city of westminster|city of london)$/i;
const POSTCODE = /^([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}$/i;

/** "Rosemary Gardens, Islington, London Borough of Islington, Greater London" → "Rosemary Gardens, Islington" */
export function shortArea(location: string | null): string {
  if (!location) return 'London';
  const borough = location.match(/(?:London|Royal) Borough of ([^,]+)/i)?.[1]?.trim();
  const parts = location
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && !NOISE.test(p) && !/^\d+$/.test(p))
    .map((p) => (POSTCODE.test(p) ? p.replace(POSTCODE, '$1').toUpperCase() : p));
  if (parts.length === 0) return borough ?? 'London';
  if (parts.length === 1 && borough && /^[A-Z]{1,2}\d/.test(parts[0])) return `${borough}, ${parts[0]}`;
  return parts.slice(0, 2).join(', ');
}

// Same wording as the badge on the feed's PostCard.
const REPEATS: Record<string, string> = {
  weekly: 'every week',
  biweekly: 'every other week',
  monthly: 'every month',
};

/** Cut at a word boundary so a long line never ends mid-word ("o…"). */
function clip(text: string, max: number) {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:]+$/, '')}…`;
}

const sentenceCase = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);

function toLivePost(row: PostRow): LivePost {
  return {
    id: row.id,
    href: `/post/${row.slug ?? row.id}`,
    title: clip(row.title ?? 'Untitled plan', 70),
    area: shortArea(row.location),
    // The same date the feed shows: a recurring listing's real next date, not
    // the stale one in its free-text `time`.
    when: sentenceCase(clip(formatListingTime(row.time ?? '', row.next_occurrence_at), 44)),
    repeats: row.recurrence_rule ? REPEATS[row.recurrence_rule] ?? null : null,
    host: (row.name ?? '').trim().split(/\s+/)[0] || 'Someone',
    interested: row.people_interested ?? 0,
  };
}

const isOneOff = (r: PostRow) => !r.recurrence_rule && !!r.expires_at && r.expires_at < STANDING_OFFER_EXPIRY;

/**
 * Up to `limit` posts: featured first, then most interest, with up to two
 * one-off plans (soonest first) always included so visitors see that dated,
 * one-time plans are on common too, not only regular things.
 */
export async function getLandingData(limit = 6): Promise<LivePost[]> {
  const { data, error } = await supabase()
    .from('posts')
    .select('id, slug, title, location, time, name, people_interested, recurrence_rule, expires_at, next_occurrence_at')
    .eq('status', 'approved')
    .eq('audience', 'everyone')
    .is('parent_post_id', null)
    .gt('expires_at', new Date().toISOString())
    .order('featured_at', { ascending: false, nullsFirst: false })
    .order('people_interested', { ascending: false, nullsFirst: false })
    .limit(60);

  if (error) {
    console.error('[landing] live posts query failed', error.message);
    return [];
  }

  const rows = data as PostRow[];
  const oneOffs = rows
    .filter(isOneOff)
    .sort((a, b) => (a.expires_at! < b.expires_at! ? -1 : 1))
    .slice(0, 2);
  const rest = rows.filter((r) => !oneOffs.includes(r)).slice(0, limit - oneOffs.length);

  // Mix the one-offs in (2nd and 4th) rather than tucking them at the end.
  const picked = [...rest];
  oneOffs.forEach((r, i) => picked.splice(Math.min(1 + i * 2, picked.length), 0, r));
  return picked.map(toLivePost);
}
