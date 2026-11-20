// Motion layer: scroll tracking, GSAP registration, and the one switch that
// turns every effect off for people who asked their OS for less motion.
//
// Everything cinematic in the app goes through here, so the reduced-motion
// promise is kept in one place instead of being remembered per component.

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Fine pointer = mouse/trackpad. Cursor follower and magnetics only run there. */
export const hasFinePointer = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// Native scrolling. Lenis used to drive the page from JavaScript on every
// frame, so on laptops any busy frame (3D, charts, icons) became a scroll
// stutter — phones never had it because Lenis leaves touch scrolling native,
// and they were the smooth ones. The browser's own scrolling runs on the
// compositor and stays smooth however busy the page is.
let started = false;
let velocity = 0;
let lastY = 0;
let lastT = 0;

export function startSmoothScroll(): null {
  if (started || typeof window === 'undefined') return null;
  started = true;
  lastY = window.scrollY;
  lastT = performance.now();
  window.addEventListener(
    'scroll',
    () => {
      const now = performance.now();
      const dt = Math.max(1, now - lastT);
      // px per 16 ms frame, the unit Lenis reported its velocity in.
      velocity = ((window.scrollY - lastY) / dt) * 16;
      lastY = window.scrollY;
      lastT = now;
    },
    { passive: true },
  );
  return null;
}

/** Current scroll speed (px/frame); decays to 0 once scrolling stops. */
export function scrollVelocity(): number {
  return performance.now() - lastT > 120 ? 0 : velocity;
}

/** Scroll to an element or the top, smoothly when Lenis runs, natively otherwise. */
export function scrollToTarget(target: HTMLElement | number, opts: { immediate?: boolean; offset?: number } = {}): void {
  const behavior: ScrollBehavior = opts.immediate || prefersReducedMotion() ? 'auto' : 'smooth';
  if (typeof target === 'number') {
    window.scrollTo({ top: target, behavior });
    return;
  }
  const top = target.getBoundingClientRect().top + window.scrollY + (opts.offset ?? -96);
  window.scrollTo({ top, behavior });
}
