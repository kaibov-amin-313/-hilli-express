// First-load intro: a counter runs to 100 while the first status request is in
// flight, then the black sheet lifts like a stage curtain. It hides real
// latency (Render's free tier can take seconds to wake) behind something that
// looks intentional. Once per browser session; skipped for reduced motion.

import { useEffect, useRef, useState } from 'react';
import { gsap, prefersReducedMotion } from '../../lib/motion';
import Lottie from '../lottie/Lottie';

const SEEN_KEY = 'aua.intro.v1';

function alreadySeen(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export default function Preloader({ ready }: { ready: boolean }) {
  const [show, setShow] = useState(() => !prefersReducedMotion() && !alreadySeen());
  const rootRef = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const progress = useRef({ v: 0 });
  const readyRef = useRef(ready);
  readyRef.current = ready;

  useEffect(() => {
    if (!show) return;
    document.documentElement.classList.add('is-loading');
    const p = progress.current;
    const start = performance.now();

    // Crawl to 86 on its own; the last stretch waits for data (or 4 s, so a
    // sleeping backend never holds the site hostage).
    const crawl = gsap.to(p, {
      v: 86,
      duration: 1.6,
      ease: 'power2.out',
      onUpdate: render,
    });

    function render() {
      const v = Math.round(p.v);
      if (numRef.current) numRef.current.textContent = String(v).padStart(3, '0');
      if (barRef.current) barRef.current.style.transform = `scaleX(${p.v / 100})`;
    }

    const poll = window.setInterval(() => {
      const elapsed = performance.now() - start;
      if ((readyRef.current && elapsed > 1400) || elapsed > 4000) {
        window.clearInterval(poll);
        crawl.kill();
        const tl = gsap.timeline({
          onComplete: () => {
            try {
              sessionStorage.setItem(SEEN_KEY, '1');
            } catch {
              /* private mode */
            }
            document.documentElement.classList.remove('is-loading');
            window.dispatchEvent(new Event('aua:intro-done'));
            setShow(false);
          },
        });
        tl.to(p, { v: 100, duration: 0.45, ease: 'power3.inOut', onUpdate: render })
          .to('[data-pre-line]', { yPercent: -110, duration: 0.6, ease: 'expo.in', stagger: 0.05 }, '+=0.1')
          .to(rootRef.current, { yPercent: -100, duration: 1.0, ease: 'expo.inOut' }, '-=0.25');
      }
    }, 100);

    return () => {
      window.clearInterval(poll);
      crawl.kill();
      document.documentElement.classList.remove('is-loading');
    };
  }, [show]);

  if (!show) return null;

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[3000] bg-[#050608] text-white flex flex-col justify-between p-6 md:p-10"
      role="status"
      aria-label="Загрузка"
    >
      <div className="flex justify-between font-mono text-2xs uppercase tracking-[0.2em] text-white/50">
        <span className="overflow-hidden"><span data-pre-line className="inline-block">AUA / Алматы</span></span>
        <span className="overflow-hidden"><span data-pre-line className="inline-block">43.24°N 76.89°E</span></span>
      </div>

      <div className="absolute right-6 md:right-10 top-1/2 -translate-y-1/2 h-[clamp(120px,22vw,300px)] w-[clamp(120px,22vw,300px)] opacity-90">
        <Lottie name="radar" color="#ffffff" className="h-full w-full" />
      </div>

      <div>
        <div className="overflow-hidden">
          <p data-pre-line className="font-display text-[clamp(40px,9vw,140px)] leading-[0.9] tracking-[-0.04em] uppercase">
            Чем мы
          </p>
        </div>
        <div className="overflow-hidden">
          <p data-pre-line className="font-display text-[clamp(40px,9vw,140px)] leading-[0.9] tracking-[-0.04em] uppercase text-white/40">
            дышим?
          </p>
        </div>
      </div>

      <div>
        <div className="flex items-end justify-between mb-4">
          <span className="font-mono text-2xs uppercase tracking-[0.2em] text-white/50 overflow-hidden">
            <span data-pre-line className="inline-block">Считываем станции</span>
          </span>
          <span className="font-display text-[clamp(48px,8vw,120px)] leading-none tabular-nums overflow-hidden">
            <span data-pre-line ref={numRef} className="inline-block">000</span>
          </span>
        </div>
        <div className="h-px bg-white/15 overflow-hidden">
          <div ref={barRef} className="h-full bg-white origin-left" style={{ transform: 'scaleX(0)' }} />
        </div>
      </div>
    </div>
  );
}
