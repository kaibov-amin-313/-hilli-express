// Scroll reveal for every screen without touching every screen.
//
// Panels (`.liquid-glass`) and anything marked `[data-reveal]` inside <main>
// start lowered and transparent, then rise in as they enter the viewport, in a
// short stagger when several arrive together. A MutationObserver picks up
// panels that mount later, after their data arrives. Nested panels are left
// alone so a tile never animates inside a card that is itself animating.
//
// Same file: the pointer spotlight. Panels expose --mx/--my so their CSS can
// paint a soft light that follows the mouse across the glass.

import { useEffect } from 'react';
import { prefersReducedMotion } from './motion';

const SELECTOR = '.liquid-glass, [data-reveal]';

export function useAutoReveal(routeKey: string): void {
  useEffect(() => {
    const main = document.querySelector('main');
    if (!main || prefersReducedMotion()) return;

    let batch = 0;
    let batchTimer = 0;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          el.style.setProperty('--rv-d', `${Math.min(batch, 6) * 70}ms`);
          batch++;
          el.classList.add('rv-in');
          io.unobserve(el);
        }
        window.clearTimeout(batchTimer);
        batchTimer = window.setTimeout(() => (batch = 0), 120);
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.01 },
    );

    const watched = new WeakSet<Element>();
    const scan = () => {
      main.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
        // Re-observe anything still hidden: StrictMode (and a route re-run)
        // tears the observer down while elements keep their `.rv` class.
        if (watched.has(el) || el.classList.contains('rv-in') || el.dataset.noReveal != null) return;
        if (el.parentElement?.closest('.rv')) return;
        el.classList.add('rv');
        watched.add(el);
        io.observe(el);
      });
    };
    scan();
    const mo = new MutationObserver(() => scan());
    mo.observe(main, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      window.clearTimeout(batchTimer);
    };
  }, [routeKey]);
}

export function usePointerSpotlight(): void {
  useEffect(() => {
    if (!window.matchMedia('(hover: hover)').matches) return;
    let current: HTMLElement | null = null;
    const onMove = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('.liquid-glass');
      if (current && current !== el) current.classList.remove('is-lit');
      current = el ?? null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
      el.classList.add('is-lit');
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);
}
