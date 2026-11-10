import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import HeroShowcase from './HeroShowcase';
import Reveal from './Reveal';
import TrackedLink from './TrackedLink';
import s from './landing.module.css';
import { getLandingData, type LivePost } from '@/lib/landing/livePosts';

/**
 * Logged-out landing page.
 * Server-rendered, so crawlers and AI assistants get real copy and real post links.
 * Live posts refresh every 5 minutes via ISR.
 */
export const revalidate = 300;

// Sign-in is a modal on the feed, so these open it there via ?start= (handled in app/HomeClient.tsx).
const ROUTES = {
  feed: '/',
  share: '/?start=share', // logged out: sign-in modal, then posting. Logged in: the create post modal
  login: '/?start=login',
  privacy: '/privacy',
  terms: '/terms',
  guidelines: '/guidelines',
};

const SITE = 'https://www.common-social.com';
const LANDING_PATH = '/welcome';
const CANONICAL_LINE = "common is a free app for finding people in London to do things with: post a plan, or join someone else's.";

export const metadata: Metadata = {
  title: 'common: find people in London to do things with',
  description: CANONICAL_LINE,
  alternates: { canonical: `${SITE}${LANDING_PATH}` },
  openGraph: {
    type: 'website',
    url: `${SITE}${LANDING_PATH}`,
    siteName: 'common',
    title: 'Find people in London to do things with',
    description: CANONICAL_LINE,
    locale: 'en_GB',
  },
  twitter: { card: 'summary_large_image', title: 'Find people in London to do things with', description: CANONICAL_LINE },
};

type FaqItem = { q: string; a: string; list?: { lead: string; text: string }[] };

const FAQ: FaqItem[] = [
  {
    q: 'How do I meet people in London?',
    a: "The easiest way to meet people in London is to do things you enjoy, with other people. A weekly class, a running club, a book club or a regular game night works because you see the same faces again. Saying yes to small, low-key plans helps too, because a tennis game or a gallery visit is easier than a big event full of strangers. common is built for exactly that: you can join someone else's plan, or post your own and see who's in.",
  },
  {
    q: 'How do I make friends in London as an adult?',
    a: "With over 7 million adults in London, and pretty much every interest, background and personality covered, there's so much opportunity to find your people. But it can feel like looking for a needle in a haystack. Here's what helps most:",
    list: [
      { lead: 'Say yes to plans.', text: 'Even the small ones. Every yes is another chance to meet someone.' },
      { lead: 'Try new things.', text: 'London has something for almost every interest, however niche, so make the most of all the weird and wonderful things you can do here.' },
      { lead: 'Be patient.', text: "Friendships take time, and most don't click on the first meeting." },
      { lead: 'Make the first move if you can.', text: 'Londoners can be shy, so plenty of people are waiting for someone else to say hello or suggest a plan.' },
      {
        lead: 'Keep seeing the same people.',
        text: 'Friendships grow from doing things you both enjoy, again and again. On common, lots of plans repeat weekly or monthly, so a one-off yes can become a regular thing.',
      },
    ],
  },
  {
    q: 'What is common?',
    a: `${CANONICAL_LINE} Each post is someone saying "I'm doing this, who's in?", whether that's beginner tennis, badminton, a photography walk or a book club.`,
  },
  { q: 'Is common free?', a: 'Yes, common is free to use. Some plans have their own costs, like a court booking or a gig ticket.' },
  { q: 'Is common only in London?', a: 'For now, yes. Everyone on common is in London, and plans are spread right across the city.' },
  { q: 'Do I need an account?', a: "You can browse every public plan without one. You only need an account to say you're interested or to post a plan." },
  { q: 'Is common a dating app?', a: "No. common is for doing things with people, not dating, and dating posts aren't allowed." },
  {
    q: 'How is common different from other meetup or friend apps?',
    a: 'Most friend apps start with a profile and a match, and leave the plan for later. Most meetup apps require the host to have figured out all the details beforehand and by themselves. common starts with the thing you want to do. There\'s no long profile to fill in and no waiting to be matched. You don\'t even need a finished plan: post an intention like "anyone up for a swim this weekend?" and work out the when and where with whoever\'s in, much more similar to how plans are made in real life.',
  },
  { q: 'Can I go on my own?', a: "Yes, and plenty of people do. Lots of plans are posted by someone going on their own who'd be glad of company." },
  {
    q: 'What can I post?',
    a: "Anything (legal) you're doing yourself and are happy to have company for. Business promotions, adverts and events you're running but not taking part in don't belong on common.",
  },
  {
    q: 'Is there a common app?',
    a: "A common app for iPhone and Android is coming soon. Until then, common works in your phone's browser, and you can add it to your home screen so it works like an app.",
  },
];

/** Stagger for groups that reveal together (cards, steps, stats). */
const delay = (i: number) => ({ '--reveal-delay': `${i * 70}ms` }) as CSSProperties;

function PostCard({ post, index }: { post: LivePost; index: number }) {
  return (
    <li data-reveal style={delay(index)}>
      <Link className={s.cardLink} href={post.href}>
        <article className={`${s.card} ${s.liveCard}`}>
          <div className={s.cardBody}>
            <h3 className={`${s.cardTitle} ${s.clamp2}`}>{post.title}</h3>
            <div className={`${s.cardLoc} ${s.clamp1}`}>{post.area}</div>
            <div className={s.cardWhenRow}>
              {post.when && <span className={s.whenText}>{post.when}</span>}
              {post.repeats && <span className={s.badge}>{post.repeats}</span>}
            </div>
          </div>
          <div className={s.cardFoot}>
            <span className={s.cardMeta}>{post.host}</span>
            {post.interested > 0 ? (
              <span className={s.badge}>{post.interested} interested</span>
            ) : (
              <span className={s.lookLink}>Take a look →</span>
            )}
          </div>
        </article>
      </Link>
    </li>
  );
}

export default async function WelcomePage() {
  const posts = await getLandingData(6);
  const topInterest = posts.reduce((max, p) => (p.interested > max.interested ? p : max), posts[0]);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'common',
      url: SITE,
      description: CANONICAL_LINE,
      applicationCategory: 'SocialNetworkingApplication',
      operatingSystem: 'Any (web browser)',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
      areaServed: { '@type': 'City', name: 'London' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map(({ q, a, list }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: [a, ...(list ?? []).map((i) => `${i.lead} ${i.text}`)].join(' ') },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Plans on common in London',
      itemListElement: posts.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.title, url: `${SITE}${p.href}` })),
    },
  ];

  return (
    <div className={s.page}>
      <Reveal />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <header className={s.nav}>
        <div className={`${s.wrap} ${s.navInner}`}>
          <Link className={s.wordmark} href={LANDING_PATH} aria-label="common home">
            common
          </Link>
          <nav className={s.navLinks} aria-label="Main">
            <TrackedLink cta="nav_see_whats_on" className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`} href={ROUTES.feed}>
              See what&apos;s on
            </TrackedLink>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className={s.hero}>
          <div className={`${s.wrap} ${s.heroGrid}`}>
            <div className={s.heroCopy}>
              <h1 className={s.h1}>Find people in London to do things with</h1>
              <p className={`${s.lede} ${s.heroLede}`}>
                Post a plan, or join someone else&apos;s. Beginner tennis, a Sunday bike ride, a gig on Thursday. common is free and works in
                your browser.
              </p>
              <div className={s.ctaRow}>
                <TrackedLink cta="hero_see_whats_on" className={`${s.btn} ${s.btnPrimary} ${s.btnLg}`} href={ROUTES.feed}>
                  See what&apos;s on
                </TrackedLink>
                <TrackedLink cta="hero_post_a_plan" className={`${s.btn} ${s.btnSecondary} ${s.btnLg}`} href="#host">
                  Post a plan
                </TrackedLink>
              </div>
              <p className={s.heroNote}>No download. First names only. Look around before you sign up.</p>
            </div>
            <HeroShowcase />
          </div>
        </section>

        {/* Live posts: the proof, and crawlable links to every post */}
        {posts.length > 0 && (
          <section className={`${s.section} ${s.band}`} id="live">
            <div className={s.wrap}>
              <div className={s.sectionHead} data-reveal>
                <div>
                  <p className={s.eyebrow}>Live on common</p>
                  <h2 className={s.h2}>What people are up to</h2>
                  <p className={s.lede}>Real plans from real people across London. Pick one and say you&apos;re in.</p>
                </div>
                <TrackedLink cta="live_see_everything" className={s.textLink} href={ROUTES.feed}>
                  See everything →
                </TrackedLink>
              </div>
              <ul className={s.gridPosts} aria-label="Plans on common now">
                {posts.map((p, i) => (
                  <PostCard key={p.id} post={p} index={i} />
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* How it works */}
        <section className={s.section} id="how">
          <div className={s.wrap}>
            <div data-reveal>
              <p className={s.eyebrow}>How it works</p>
              <h2 className={s.h2}>From scrolling to actually going</h2>
            </div>
            <ol className={s.steps}>
              <li className={s.stepItem} data-reveal style={delay(0)}>
                <h3>Find something</h3>
                <p>See what people across London are up to. Sort by what&apos;s soonest or what&apos;s nearest. No algorithm deciding for you.</p>
              </li>
              <li className={s.stepItem} data-reveal style={delay(1)}>
                <h3>Say you&apos;re in</h3>
                <p>Tap I&apos;m interested and a chat opens with the host, 1:1 or with the whole group. The hello is already written.</p>
              </li>
              <li className={s.stepItem} data-reveal style={delay(2)}>
                <h3>Sort it and go</h3>
                <p>Agree a time, find the spot, turn up. The chat is there to make the plan happen, then it gets out of your way.</p>
              </li>
            </ol>
          </div>
        </section>

        {/* Plans, not profiles */}
        <section className={`${s.section} ${s.flushTop}`}>
          <div className={`${s.wrap} ${s.split}`}>
            <div data-reveal>
              <p className={s.eyebrow}>Plans, not profiles</p>
              <h2 className={s.h2}>Most apps want you to perform. common just wants you to go.</h2>
              <p className={s.lede}>
                There&apos;s nothing to keep up with here. No feed of other people&apos;s lives, no numbers next to your name. Just a calm list
                of things to do and people who fancy doing them too.
              </p>
            </div>
            <ul className={s.nots}>
              {[
                ['No likes or followers', 'nobody’s counting'],
                ['No bios to agonise over', 'a first name will do'],
                ['No swiping', 'it’s not a dating app'],
                ['No algorithm', 'newest, soonest or nearest'],
                ['No group chat sprawl', 'one chat per plan'],
              ].map(([a, b], i) => (
                <li key={a} data-reveal style={delay(i)}>
                  <span>{a}</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Proof */}
        <section className={`${s.section} ${s.flushTop}`}>
          <div className={s.wrap}>
            <div data-reveal>
              <p className={s.eyebrow}>So far</p>
              <h2 className={s.h2}>People are already making plans</h2>
            </div>
            <div className={s.proof}>
              {topInterest && topInterest.interested >= 5 && (
                <div className={s.stat} data-reveal style={delay(0)}>
                  <div className={s.statNum}>{topInterest.interested}</div>
                  <p>people said they&apos;re in for one post: {topInterest.title.toLowerCase()}</p>
                </div>
              )}
              <div className={s.stat} data-reveal style={delay(1)}>
                <div className={s.statNum}>1,000+</div>
                <p>messages sent between people sorting out plans</p>
              </div>
              <div className={s.stat} data-reveal style={delay(2)}>
                <div className={s.statNum}>£0</div>
                <p>to use common. It will never charge you to meet people.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Hosts: supply is the constraint, so this gets its own band */}
        <section className={`${s.section} ${s.band}`} id="host">
          <div className={`${s.wrap} ${s.split}`}>
            <div data-reveal>
              <p className={s.eyebrow}>Got a plan?</p>
              <h2 className={s.h2}>Doing something anyway? Post it</h2>
              <p className={s.lede}>
                You don&apos;t need to run a club or have a date set. Say what you&apos;re doing and who&apos;s welcome. People who want in will
                message you.
              </p>
              <div className={s.ctaRow}>
                <TrackedLink cta="host_post_a_plan" className={`${s.btn} ${s.btnPrimary} ${s.btnLg}`} href={ROUTES.share}>
                  Post a plan
                </TrackedLink>
              </div>
            </div>
            <div className={s.hostCard} data-reveal style={delay(1)}>
              <h3>You decide</h3>
              <ul className={s.ticks}>
                <li>One chat with each person, or one group chat for everyone</li>
                <li>Show it to everyone, or just your friends on common</li>
                <li>Once, or repeating weekly, every two weeks or monthly</li>
                <li>No date yet? Post it anyway and sort the details in the chat</li>
                <li>Close it whenever you like</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Safety */}
        <section className={s.section}>
          <div className={s.wrap}>
            <div data-reveal>
              <p className={s.eyebrow}>Meeting new people, sensibly</p>
              <h2 className={s.h2}>You stay in control</h2>
            </div>
            <div className={s.safety}>
              {[
                ['First names only', 'No surnames, no handles, no public list of who you know.'],
                ['18 and over', 'Everyone confirms their age when they sign up.'],
                ['Block or report', 'Anyone, any time, straight from the chat.'],
                ['Meet in public', 'Pick somewhere busy the first time.'],
              ].map(([h, p], i) => (
                <div key={h} data-reveal style={delay(i)}>
                  <h3>{h}</h3>
                  <p>{p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className={`${s.section} ${s.flushTop}`} id="faq">
          <div className={s.wrap}>
            <div data-reveal>
              <p className={s.eyebrow}>Questions</p>
              <h2 className={s.h2}>Good to know</h2>
            </div>
            <div className={s.faq}>
              {FAQ.map(({ q, a, list }) => (
                <details key={q}>
                  <summary>{q}</summary>
                  <div className={s.faqBody}>
                    <p>{a}</p>
                    {list && (
                      <ul>
                        {list.map((i) => (
                          <li key={i.lead}>
                            <strong>{i.lead}</strong> {i.text}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Closing */}
        <section className={`${s.section} ${s.flushTop}`}>
          <div className={s.wrap}>
            <div className={s.closingCard} data-reveal>
              <div>
                <h2 className={`${s.h2} ${s.closingH2}`}>Your next plan is probably already on here</h2>
                <p className={`${s.lede} ${s.muted}`}>Have a look. Signing up takes a minute when you find one you like.</p>
              </div>
              <div className={s.ctaRow}>
                <TrackedLink cta="closing_see_whats_on" className={`${s.btn} ${s.btnPrimary} ${s.btnLg}`} href={ROUTES.feed}>
                  See what&apos;s on
                </TrackedLink>
                <TrackedLink cta="closing_post_a_plan" className={`${s.btn} ${s.btnSecondary} ${s.btnLg}`} href={ROUTES.share}>
                  Post a plan
                </TrackedLink>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={`${s.wrap} ${s.footerInner}`}>
          <Link className={s.wordmark} href={LANDING_PATH}>
            common
          </Link>
          <nav className={s.footerLinks} aria-label="Footer">
            <Link href={ROUTES.feed}>See what&apos;s on</Link>
            <Link href={ROUTES.login}>Log in</Link>
            <Link href={ROUTES.guidelines}>Guidelines</Link>
            <Link href={ROUTES.privacy}>Privacy</Link>
            <Link href={ROUTES.terms}>Terms</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
