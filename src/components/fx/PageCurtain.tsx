// Screen-to-screen transition. A panel in the current status colour sweeps up
// over the page carrying the destination's name, the route commits
// underneath, then the panel continues off the top. Navigation between five
// screens reads as cuts in one film rather than five separate pages.

import { useEffect, useRef } from 'react';
import { gsap, prefersReducedMotion } from '../../lib/motion';
import { setNavigationInterceptor } from '../../lib/router';

const NAMES: Record<string, [string, string]> = {
  '/': ['01', 'Сейчас'],
  '/map': ['02', 'Карта'],
  '/forecast': ['03', 'Прогноз'],
  '/stations': ['04', 'Станции'],
  '/dashboard': ['05', 'Дэшборд'],
  '/about': ['06', 'О проекте'],
};

function nameFor(path: string): [string, string] {
  const root = `/${path.split('/').filter(Boolean)[0] ?? ''}`;
  return NAMES[root === '/' ? '/' : root] ?? ['—', 'AUA'];
}

export default function PageCurtain() {
  const rootRef = useRef<HTMLDivElement>(null);
  const idxRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const root = rootRef.current!;

    setNavigationInterceptor((to, commit) => {
      if (busy.current) {
        commit();
        return;
      }
      busy.current = true;
      const [idx, title] = nameFor(to);
      idxRef.current!.textContent = idx;
      titleRef.current!.textContent = title;

      gsap
        .timeline({
          onComplete: () => {
            busy.current = false;
          },
        })
        .set(root, { yPercent: 100, visibility: 'visible' })
        .set('[data-curtain-line]', { yPercent: 110 })
        .to(root, { yPercent: 0, duration: 0.6, ease: 'expo.inOut' })
        .to('[data-curtain-line]', { yPercent: 0, duration: 0.5, ease: 'expo.out', stagger: 0.06 }, '-=0.2')
        .add(() => commit())
        .to('[data-curtain-line]', { yPercent: -110, duration: 0.4, ease: 'expo.in', stagger: 0.04 }, '+=0.15')
        .to(root, { yPercent: -100, duration: 0.7, ease: 'expo.inOut' }, '-=0.15')
        .set(root, { visibility: 'hidden' });
    });
    return () => setNavigationInterceptor(null);
  }, []);

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[2500] flex items-end p-6 md:p-12 pointer-events-none"
      style={{ visibility: 'hidden', background: 'var(--status-c)', color: '#06070a' }}
      aria-hidden="true"
    >
      <div className="flex items-end gap-4 md:gap-8">
        <span className="overflow-hidden">
          <span ref={idxRef} data-curtain-line className="inline-block font-mono text-sm md:text-md">01</span>
        </span>
        <span className="overflow-hidden">
          <span
            ref={titleRef}
            data-curtain-line
            className="inline-block font-display uppercase text-[clamp(48px,11vw,180px)] leading-[0.85] tracking-[-0.05em]"
          >
            Сейчас
          </span>
        </span>
      </div>
    </div>
  );
}
