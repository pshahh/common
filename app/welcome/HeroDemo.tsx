'use client';

import { useState } from 'react';
import s from './landing.module.css';

/**
 * "Join a plan" in the hero: the design-system PostCard, plus the chat that
 * opens when you tap "I'm interested". The whole conversation renders at rest
 * (no JS needed to read it) and plays once in CSS. Each tap replays it.
 */
export default function HeroDemo({ onInteract }: { onInteract?: () => void }) {
  const [joined, setJoined] = useState(false);
  const [run, setRun] = useState(0);

  const toggle = () => {
    onInteract?.();
    setJoined((j) => {
      if (!j) setRun((r) => r + 1);
      return !j;
    });
  };

  return (
    <div className={s.demo} aria-label="Example of a plan on common and the chat it opens">
      <div className={`${s.card} ${s.demoCard}`}>
        <div className={s.cardBody}>
          <div className={s.cardTitle}>Beginners only chess</div>
          <div className={s.cardLoc}>Alpaca pub, Angel</div>
          <div className={s.cardWhenRow}>
            <span className={s.whenText}>Thursday evening</span>
            <span className={s.badge}>every week</span>
          </div>
          <div className={s.cardNotes}>Complete beginners welcome. I&apos;ll bring a board</div>
        </div>
        <div className={s.cardFoot}>
          <div className={s.cardMetaStack}>
            <span>Jim</span>
            <span key={joined ? 'in' : 'out'} className={run > 0 ? s.bump : undefined}>
              {joined ? 4 : 3} interested
            </span>
          </div>
          <button
            type="button"
            className={`${s.btn} ${joined ? s.btnSecondary : s.btnPrimary} ${s.cardBtn}`}
            onClick={toggle}
            aria-pressed={joined}
          >
            {joined ? "You're in" : "I'm interested"}
          </button>
        </div>
      </div>

      {/* key={run} remounts the thread so the entrance animation replays */}
      <div key={run} className={`${s.thread} ${run > 0 ? s.replay : ''}`} aria-live="polite">
        <div className={`${s.threadHead} ${s.step} ${s.step1}`}>Chat with Jim</div>
        <div className={`${s.bubble} ${s.bubbleOut} ${s.step} ${s.step2}`}>hey, I&apos;d be up for joining this</div>
        <div className={`${s.bubble} ${s.bubbleIn} ${s.hasReaction} ${s.step} ${s.step3}`}>
          nice, see you thursday from 7. ask for the chess table
          <span className={s.reaction} aria-label="reacted thumbs up">
            👍
          </span>
        </div>
      </div>
      <p className={s.demoCaption}>Tap I&apos;m interested to try it. The first message is written for you.</p>
    </div>
  );
}
