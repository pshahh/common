// Local data for demo mode (App Store screenshots). Never shipped: only
// lib/demo/demoClient.ts imports this, and lib/supabase.ts only loads that in
// development. Everyone here is made up, first names only.
//
// Dates are relative to today so the demo never goes stale.

const DAY = 24 * 60 * 60 * 1000;

function daysFromNow(days: number, hour = 0, minute = 0): Date {
  const d = new Date(Date.now() + days * DAY);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// Next given weekday (0 = Sunday), at least `minDays` away
function nextWeekday(weekday: number, minDays = 1): Date {
  for (let i = minDays; i < minDays + 7; i++) {
    const d = daysFromNow(i);
    if (d.getDay() === weekday) return d;
  }
  return daysFromNow(minDays);
}

// Same format CreatePostModal writes: "Sunday 18 October, 9am"
function timeText(date: Date, timeOfDay: string): string {
  const day = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  return `${day}, ${timeOfDay}`;
}

function iso(date: Date): string {
  return date.toISOString();
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export const DEMO_USER_ID = 'demo-user-sam';

const people = {
  sam: { id: DEMO_USER_ID, first_name: 'Sam', dob: '1993-05-14' },
  ella: { id: 'demo-user-ella', first_name: 'Ella', dob: '1995-02-03' },
  kwame: { id: 'demo-user-kwame', first_name: 'Kwame', dob: '1990-09-21' },
  aisha: { id: 'demo-user-aisha', first_name: 'Aisha', dob: '1997-11-08' },
  leo: { id: 'demo-user-leo', first_name: 'Leo', dob: '1988-04-17' },
  rosa: { id: 'demo-user-rosa', first_name: 'Rosa', dob: '1994-07-30' },
  dan: { id: 'demo-user-dan', first_name: 'Dan', dob: '1991-01-12' },
};

export const demoUser = {
  id: DEMO_USER_ID,
  email: 'sam@example.com',
  aud: 'authenticated',
  role: 'authenticated',
  email_confirmed_at: hoursAgo(24 * 60),
  created_at: hoursAgo(24 * 90),
  app_metadata: {},
  user_metadata: {},
};

const profiles = Object.values(people).map((p) => ({
  id: p.id,
  first_name: p.first_name,
  avatar_url: null,
  date_of_birth: p.dob,
  is_admin: false,
}));

const sunday = nextWeekday(0);
const thursday = nextWeekday(4);
const saturday = nextWeekday(6);
const friday = nextWeekday(5);
const wednesday = nextWeekday(3);

function post(fields: {
  id: string;
  author: { id: string; first_name: string };
  title: string;
  location: string;
  latitude: number;
  longitude: number;
  date: Date;
  timeOfDay: string;
  notes: string;
  people_interested: number;
  thread_type: 'group' | '1:1';
  created_hours_ago: number;
  recurrence_rule?: string;
  featured?: boolean;
}) {
  return {
    id: fields.id,
    title: fields.title,
    location: fields.location,
    latitude: fields.latitude,
    longitude: fields.longitude,
    time: timeText(fields.date, fields.timeOfDay),
    notes: fields.notes,
    name: fields.author.first_name,
    preference: 'anyone',
    people_interested: fields.people_interested,
    user_id: fields.author.id,
    created_at: hoursAgo(fields.created_hours_ago),
    expires_at: fields.recurrence_rule ? iso(new Date('2099-12-31')) : iso(new Date(fields.date.getTime() + DAY)),
    recurrence_rule: fields.recurrence_rule ?? null,
    slug: fields.id,
    thread_type: fields.thread_type,
    audience: 'everyone',
    parent_post_id: null,
    featured_at: fields.featured ? hoursAgo(2) : null,
    next_occurrence_at: fields.recurrence_rule ? iso(fields.date) : null,
    resurfaced_at: null,
    status: 'approved',
    interested_user_ids: [],
  };
}

const posts = [
  post({
    id: 'demo-post-run',
    author: people.ella,
    title: 'Sunday morning run around Victoria Park',
    location: 'Victoria Park, Hackney',
    latitude: 51.5362,
    longitude: -0.0383,
    date: sunday,
    timeOfDay: '9am',
    notes: 'Easy 5k at a chatty pace, two loops of the park. Coffee at the Pavilion after if you fancy it.',
    people_interested: 4,
    thread_type: 'group',
    created_hours_ago: 30,
    recurrence_rule: 'weekly',
    featured: true,
  }),
  post({
    id: 'demo-post-quiz',
    author: people.kwame,
    title: 'Pub quiz at the Lamb, we need a fourth',
    location: 'The Lamb, Bloomsbury',
    latitude: 51.5225,
    longitude: -0.1188,
    date: thursday,
    timeOfDay: '7:30pm',
    notes: "We're good on music and hopeless on sport. Come and fix that.",
    people_interested: 2,
    thread_type: '1:1',
    created_hours_ago: 3,
  }),
  post({
    id: 'demo-post-lido',
    author: people.leo,
    title: 'Early swim at Brockwell Lido',
    location: 'Brockwell Lido, Herne Hill',
    latitude: 51.4532,
    longitude: -0.1063,
    date: saturday,
    timeOfDay: '8am',
    notes: "Cold but worth it. I'll be in the medium lane, then breakfast at the café.",
    people_interested: 1,
    thread_type: '1:1',
    created_hours_ago: 6,
  }),
  post({
    id: 'demo-post-games',
    author: people.rosa,
    title: 'Board games night in Waterloo',
    location: 'Draughts, Waterloo',
    latitude: 51.5013,
    longitude: -0.1133,
    date: friday,
    timeOfDay: '7pm',
    notes: "I'll bring Wingspan. Anyone who can teach me Root gets a drink.",
    people_interested: 3,
    thread_type: 'group',
    created_hours_ago: 9,
  }),
  post({
    id: 'demo-post-canal',
    author: people.dan,
    title: "Walk along Regent's Canal to Little Venice",
    location: 'Camden Lock',
    latitude: 51.5414,
    longitude: -0.1460,
    date: saturday,
    timeOfDay: '11am',
    notes: 'About two hours at an easy pace. Lunch somewhere along the way.',
    people_interested: 2,
    thread_type: 'group',
    created_hours_ago: 20,
  }),
  post({
    id: 'demo-post-drawing',
    author: people.aisha,
    title: 'Life drawing class in Bethnal Green',
    location: 'Bethnal Green',
    latitude: 51.5270,
    longitude: -0.0549,
    date: wednesday,
    timeOfDay: '6:30pm',
    notes: "I've booked my place and there are a few left. All levels, I'm very much a beginner.",
    people_interested: 1,
    thread_type: '1:1',
    created_hours_ago: 26,
  }),
  // Sam has joined this one, so the feed hides it; it's the group chat below
  post({
    id: 'demo-post-football',
    author: people.kwame,
    title: 'Five a side on Hackney Marshes',
    location: 'Hackney Marshes',
    latitude: 51.5530,
    longitude: -0.0300,
    date: saturday,
    timeOfDay: '10am',
    notes: 'Friendly game, all abilities. We usually go for a drink after.',
    people_interested: 5,
    thread_type: 'group',
    created_hours_ago: 40,
  }),
];

const footballPost = posts[posts.length - 1];

export const DEMO_GROUP_THREAD_ID = 'demo-thread-football';

const threads = [
  {
    id: DEMO_GROUP_THREAD_ID,
    post_id: footballPost.id,
    participant_ids: [people.kwame.id, DEMO_USER_ID, people.leo.id, people.aisha.id],
    created_by: people.kwame.id,
    created_at: hoursAgo(28),
    last_message_at: hoursAgo(1),
    thread_type: 'group',
    posts: footballPost,
  },
];

function message(id: string, sender: { id: string }, content: string, hours: number, reactions: { user: { id: string }; emoji: string }[] = []) {
  return {
    id,
    thread_id: DEMO_GROUP_THREAD_ID,
    sender_id: sender.id,
    content,
    created_at: hoursAgo(hours),
    message_type: 'user',
    message_reactions: reactions.map((r, i) => ({
      id: `${id}-reaction-${i}`,
      message_id: id,
      user_id: r.user.id,
      emoji: r.emoji,
    })),
  };
}

const messages = [
  message('demo-msg-1', people.kwame, "We've got pitch 4 from 10. Bring a light top and a dark top so we can split into teams.", 26, [
    { user: people.leo, emoji: '👍' },
    { user: people.aisha, emoji: '👍' },
    { user: people.sam, emoji: '👍' },
  ]),
  message('demo-msg-2', people.leo, 'Is it grass or astro?', 25),
  message('demo-msg-3', people.kwame, 'Grass, so boots if you have them. Trainers are fine too.', 24.5),
  message('demo-msg-6', people.leo, "I'll bring a pump, the ball was a bit flat last time", 8),
  message('demo-msg-7', people.kwame, 'Legend', 7.5),
  message('demo-msg-4', people.aisha, "I haven't played in years, go easy on me", 5, [
    { user: people.kwame, emoji: '😂' },
  ]),
  message('demo-msg-5', people.sam, 'Same here. See you all Saturday', 1.2, [
    { user: people.aisha, emoji: '❤️' },
  ]),
];

// Rows per table, in the shape the app's queries expect (embedded relations
// such as threads.posts and messages.message_reactions are pre-joined).
export function buildDemoTables(): Record<string, Record<string, unknown>[]> {
  return {
    profiles,
    posts,
    threads,
    messages,
    message_reactions: messages.flatMap((m) => m.message_reactions),
    thread_reads: [{ thread_id: DEMO_GROUP_THREAD_ID, user_id: DEMO_USER_ID, last_read_at: hoursAgo(3) }],
    blocked_users: [],
    friendships: [],
    reports: [],
    device_tokens: [],
  };
}
