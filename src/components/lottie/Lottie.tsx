// Lottie player for the files in /public/lottie.
//
// HUD line-art: thin white strokes plus one placeholder accent ([1,0,1]).
// At load the placeholder is replaced with the current air-status colour, so
// the same station / lungs / smoke animation turns green, amber or red with
// the air. Animations play only while on screen, and hold a still frame for
// people who asked their system for reduced motion.

import { useEffect, useRef } from 'react';
import type { AnimationItem } from 'lottie-web';
import lottie from 'lottie-web/build/player/lottie_light';
import { prefersReducedMotion } from '../../lib/motion';
import { useApp } from '../../lib/appState';
import { asKey } from '../../lib/api';

// Mirrors --good / --mid / --bad in index.css. Resolved from app state rather
// than read off the CSS variable, because the variable is updated in an effect
// that runs after this component has already rendered.
export const STATUS_HEX = { good: '#4ade80', mid: '#fbbf24', bad: '#fb7185' } as const;

export type LottieName =
  | 'radar'
  | 'signal'
  | 'target'
  | 'gauge'
  | 'graph'
  | 'wind'
  | 'scan'
  | 'lungs'
  | 'alert'
  | 'pulse';

const cache = new Map<LottieName, Promise<string>>();

function load(name: LottieName): Promise<string> {
  let p = cache.get(name);
  if (!p) {
    p = fetch(`/lottie/${name}.json`).then((r) => {
      if (!r.ok) throw new Error(`lottie ${name}: ${r.status}`);
      return r.text();
    });
    cache.set(name, p);
  }
  return p;
}

/** CSS colour (hex or var(--x)) → Lottie's 0..1 RGB array literal. */
function toLottieRgb(color: string): string {
  let c = color.trim();
  const v = c.match(/^var\((--[\w-]+)\)$/);
  if (v) c = getComputedStyle(document.documentElement).getPropertyValue(v[1]).trim();
  const hex = c.replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((h) => h + h).join('') : hex;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return '[1,1,1,1]';
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  return `[${r.toFixed(3)},${g.toFixed(3)},${b.toFixed(3)},1]`;
}

interface Props {
  name: LottieName;
  /** Accent colour (hex or var(--x)); defaults to the live status colour. */
  color?: string;
  className?: string;
  loop?: boolean;
  /** Frame shown when motion is reduced. */
  stillFrame?: number;
  speed?: number;
  preserveAspectRatio?: string;
}

export default function Lottie({
  name,
  color,
  className = '',
  loop = true,
  stillFrame = 60,
  speed = 1,
  preserveAspectRatio = 'xMidYMid meet',
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // Re-resolve when the status colour changes even though the prop string
  // (`var(--status-c)`) stays the same.
  const { status } = useApp();
  const statusHex = STATUS_HEX[status ? asKey(status.status) : 'good'];
  const resolved = toLottieRgb(color ?? statusHex);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let anim: AnimationItem | null = null;
    let io: IntersectionObserver | null = null;
    let alive = true;

    void load(name)
      .then((raw) => {
        if (!alive) return;
        const data = JSON.parse(raw.split('[1,0,1,1]').join(resolved));
        anim = lottie.loadAnimation({
          container: el,
          renderer: 'svg',
          loop,
          autoplay: false,
          animationData: data,
          rendererSettings: { preserveAspectRatio },
        });
        anim.setSpeed(speed);
        // The files are authored at 60 fps. Without this, lottie interpolates a
        // new SVG frame on every display refresh — 120 a second on a ProMotion
        // MacBook, for each icon on screen.
        anim.setSubframe(false);
        if (prefersReducedMotion()) {
          anim.goToAndStop(stillFrame, true);
          return;
        }
        io = new IntersectionObserver(([e]) => {
          if (e.isIntersecting) anim?.play();
          else anim?.pause();
        });
        io.observe(el);
      })
      .catch(() => {
        /* decorative — a missing animation must never break the screen */
      });

    return () => {
      alive = false;
      io?.disconnect();
      anim?.destroy();
    };
  }, [name, resolved, loop, stillFrame, speed, preserveAspectRatio]);

  return <div ref={ref} className={className} aria-hidden="true" />;
}
