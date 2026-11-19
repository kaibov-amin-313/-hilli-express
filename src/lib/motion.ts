// Motion layer: smooth scroll, GSAP registration, and the one switch that
// turns every effect off for people who asked their OS for less motion.
//
// Everything cinematic in the app goes through here, so the reduced-motion
// promise is kept in one place instead of being remembered per component.

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Fine pointer = mouse/trackpad. Cursor follower and magnetics only run there. */
export const hasFinePointer = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

let lenis: Lenis | null = null;

export function startSmoothScroll(): Lenis | null {
  if (lenis || prefersReducedMotion()) return lenis;
  lenis = new Lenis({
    // Light smoothing: a long glide reads as input lag, not polish.
    lerp: 0.16,
    // Inner scroll areas (the chat list) opt out with data-lenis-prevent.
    prevent: (node) => !!node.closest?.('[data-lenis-prevent]'),
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis?.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

export function getLenis(): Lenis | null {
  return lenis;
}

/** Scroll to an element or the top, smoothly when Lenis runs, natively otherwise. */
export function scrollToTarget(target: HTMLElement | number, opts: { immediate?: boolean; offset?: number } = {}): void {
  if (lenis) {
    lenis.scrollTo(target, { immediate: opts.immediate, offset: opts.offset ?? -96 });
    return;
  }
  if (typeof target === 'number') window.scrollTo({ top: target, behavior: opts.immediate ? 'auto' : 'smooth' });
  else target.scrollIntoView({ behavior: opts.immediate ? 'auto' : 'smooth', block: 'center' });
}
