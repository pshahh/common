'use client';

import { useEffect, useRef, useState } from 'react';
import s from './landing.module.css';

type Field = 'what' | 'where' | 'when';
type Example = Record<Field, string> & { chat: '1:1' | 'Group'; often: string };

const OFTEN = ['Just once', 'Weekly', 'Every two weeks', 'Monthly'];

// Made-up examples that show the range: a regular thing, a one-off, a standing offer.
const EXAMPLES: Example[] = [
  { what: 'Sunday bouldering, total beginners', where: 'The Castle, Stoke Newington', when: 'Sunday mornings', chat: 'Group', often: 'Weekly' },
  { what: 'Jazz at the Vortex', where: 'Dalston', when: 'Friday 27 November, 8pm', chat: '1:1', often: 'Just once' },
  { what: 'Life drawing in a pub', where: 'Hackney Wick', when: 'Thursday evenings', chat: 'Group', often: 'Every two weeks' },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The "post a plan" form, filling itself in with example plans so visitors
 * see how little it takes. Types only while it's on screen, its hero tab is
 * selected (`active`) and the browser tab is visible. Renders the first
 * example complete on the server and with reduced motion.
 */
export default function HostComposer({ active: tabActive = true }: { active?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useRef(false);
  const activeRef = useRef(tabActive);
  activeRef.current = tabActive;
  const [ex, setEx] = useState(0);
  const [text, setText] = useState<Record<Field, string>>({ what: EXAMPLES[0].what, where: EXAMPLES[0].where, when: EXAMPLES[0].when });
  const [pills, setPills] = useState(true);
  const [active, setActive] = useState<Field | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;

    let cancelled = false;
    let started = false;
    const waitUntilShown = async () => {
      while (!cancelled && (!visible.current || !activeRef.current || document.hidden)) await sleep(250);
    };

    async function run() {
      await waitUntilShown();
      await sleep(1400); // let people read the first example before it changes
      for (let i = 1; !cancelled; i++) {
        const e = EXAMPLES[i % EXAMPLES.length];
        await waitUntilShown();
        if (cancelled) return;
        setEx(i % EXAMPLES.length);
        setPills(false);
        setText({ what: '', where: '', when: '' });
        for (const field of ['what', 'where', 'when'] as Field[]) {
          setActive(field);
          for (let c = 1; c <= e[field].length; c++) {
            await waitUntilShown();
            if (cancelled) return;
            setText((t) => ({ ...t, [field]: e[field].slice(0, c) }));
            await sleep(34 + Math.random() * 40);
          }
          await sleep(220);
        }
        setActive(null);
        setPills(true);
        await sleep(3200);
      }
    }

    const io = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
      if (entry.isIntersecting && !started) {
        started = true;
        run();
      }
    }, { threshold: 0.35 });
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, []);

  const e = EXAMPLES[ex];
  const field = (name: Field, label: string) => (
    <div>
      <span className={s.fieldLabel}>{label}</span>
      <div className={`${s.input} ${active === name ? s.inputActive : ''}`}>
        {text[name]}
        {active === name && <span className={s.caret} />}
        {!text[name] && active !== name && <span className={s.placeholder}>&nbsp;</span>}
      </div>
    </div>
  );

  return (
    <div ref={ref} className={s.composer} role="img" aria-label="Example of posting a plan on common: what, where, when, who can see it, chat type and how often">
      <div className={s.composerInner} aria-hidden="true">
        {field('what', 'What')}
        {field('where', 'Where')}
        {field('when', 'When')}
        <div>
          <span className={s.fieldLabel}>Who can see it</span>
          <div className={s.pills}>
            <span className={`${s.pill} ${pills ? s.pillOn : ''}`}>Everyone</span>
            <span className={s.pill}>Friends only</span>
          </div>
        </div>
        <div>
          <span className={s.fieldLabel}>Chat</span>
          <div className={s.pills}>
            {(['1:1', 'Group'] as const).map((c) => (
              <span key={c} className={`${s.pill} ${pills && e.chat === c ? s.pillOn : ''}`}>
                {c}
              </span>
            ))}
          </div>
        </div>
        <div>
          <span className={s.fieldLabel}>How often</span>
          <div className={s.pills}>
            {OFTEN.map((o) => (
              <span key={o} className={`${s.pill} ${pills && e.often === o ? s.pillOn : ''}`}>
                {o}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
