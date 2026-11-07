// Shared time and preview formatting for the message thread and chat lists.
//
// Everything is 24-hour, en-GB, in the viewer's local timezone. Formatters are
// built once here: constructing an Intl.DateTimeFormat is far slower than
// calling format() on one, and these run for every bubble and every row.

const LOCALE = 'en-GB';
const DAY_MS = 24 * 60 * 60 * 1000;

const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const weekdayLongFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'long' });
const weekdayShortFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' });
const dayMonthFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' });
const dayMonthYearFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// Whole calendar days between the date and today (0 = today, 1 = yesterday).
// Rounded so a DST change (23 or 25 hour day) still counts as one day.
export function calendarDaysAgo(value: string | Date, now: Date = new Date()): number {
  return Math.round((startOfDay(now) - startOfDay(toDate(value))) / DAY_MS);
}

// Local calendar-day key, for spotting where the day changes.
export function dayKey(value: string | Date): string {
  const d = toDate(value);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// "31 Oct", or "31 Oct 2025" outside the current year.
function dayMonth(d: Date, now: Date): string {
  return (d.getFullYear() === now.getFullYear() ? dayMonthFmt : dayMonthYearFmt).format(d);
}

// "09:02"
export function formatClockTime(value: string | Date): string {
  return timeFmt.format(toDate(value));
}

// Day separator in a thread: "Today", "Yesterday", "Thursday", "Sat 31 Oct",
// "Sat 31 Oct 2025".
export function formatDayLabel(value: string | Date, now: Date = new Date()): string {
  const d = toDate(value);
  const days = calendarDaysAgo(d, now);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days > 1 && days <= 6) return weekdayLongFmt.format(d);
  return `${weekdayShortFmt.format(d)} ${dayMonth(d, now)}`;
}

// Hover title on a bubble: "Thu 5 Nov, 20:31".
export function formatFullTime(value: string | Date, now: Date = new Date()): string {
  const d = toDate(value);
  return `${weekdayShortFmt.format(d)} ${dayMonth(d, now)}, ${timeFmt.format(d)}`;
}

// Chat list row: "20:31", "Yesterday", "Tue", "3 Nov", "3 Nov 2025".
export function formatRowTime(value: string | Date, now: Date = new Date()): string {
  const d = toDate(value);
  const days = calendarDaysAgo(d, now);
  if (days <= 0) return timeFmt.format(d);
  if (days === 1) return 'Yesterday';
  if (days <= 6) return weekdayShortFmt.format(d);
  return dayMonth(d, now);
}

export interface PreviewMessage {
  sender_id: string;
  content: string;
  message_type: string | null;
}

// One line of preview text with the right sender prefix.
export function formatPreview(
  message: PreviewMessage,
  opts: { currentUserId: string; isGroup: boolean; senderFirstName?: string | null }
): string {
  const text = message.content.replace(/\s+/g, ' ').trim();
  if (message.message_type === 'system') return text;
  if (message.sender_id === opts.currentUserId) return `You: ${text}`;
  if (opts.isGroup && opts.senderFirstName) return `${opts.senderFirstName}: ${text}`;
  return text;
}
