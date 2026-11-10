'use client';

import { useEffect, useRef, useState } from 'react';
import posthog from 'posthog-js';
import HeroDemo from './HeroDemo';
import HostComposer from './HostComposer';
import s from './landing.module.css';

type Tab = 'join' | 'post';

/**
 * The hero's right-hand side: both halves of common in one place.
 * "Join a plan" shows the post card and the chat it opens; "Post a plan" shows
 * the form filling itself in. It starts on Join (what most visitors come for),
 * then moves to Post once, after the chat has played, unless the visitor has
 * already tapped something. After that it only changes when they choose.
 * Both panels share one grid cell, so switching never shifts the page.
 */
export default function HeroShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const touched = useRef(false);
  const [tab, setTab] = useState<Tab>('join');
  const [joinVisits, setJoinVisits] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    let timer: ReturnType<typeof setTimeout>;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        // The chat finishes about 3.5s in. Give people a moment with it, then show the other side.
        timer = setTimeout(() => {
          if (!touched.current) setTab('post');
        }, 6000);
        io.disconnect();
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(timer);
    };
  }, []);

  const choose = (next: Tab) => {
    touched.current = true;
    if (next === tab) return;
    if (next === 'join') setJoinVisits((v) => v + 1); // replay the chat when coming back to it
    setTab(next);
    try {
      posthog.capture('landing_demo_tab', { tab: next });
    } catch {
      /* analytics must never break the page */
    }
  };

  const tabButton = (id: Tab, label: string) => (
    <button
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={tab === id}
      aria-controls={`panel-${id}`}
      className={`${s.pill} ${s.tabPill} ${tab === id ? s.pillOn : ''}`}
      onClick={() => choose(id)}
    >
      {label}
    </button>
  );

  return (
    <div ref={ref} className={s.showcase}>
      <div className={s.tabs} role="tablist" aria-label="See how common works">
        {tabButton('join', 'Join a plan')}
        {tabButton('post', 'Post a plan')}
      </div>
      <div className={s.panels}>
        <div id="panel-join" role="tabpanel" aria-labelledby="tab-join" className={`${s.panel} ${tab === 'join' ? s.panelOn : ''}`} inert={tab !== 'join'}>
          <HeroDemo key={joinVisits} onInteract={() => (touched.current = true)} />
        </div>
        <div id="panel-post" role="tabpanel" aria-labelledby="tab-post" className={`${s.panel} ${tab === 'post' ? s.panelOn : ''}`} inert={tab !== 'post'}>
          <HostComposer active={tab === 'post'} />
          <p className={s.demoCaption}>That&apos;s the whole form. Post it and people who fancy it message you.</p>
        </div>
      </div>
    </div>
  );
}
