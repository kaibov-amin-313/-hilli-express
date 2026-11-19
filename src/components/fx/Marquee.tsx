// Endless ticker. The track is rendered twice and slid by exactly one copy's
// width, so the loop is seamless at any content length. Scroll velocity
// briefly speeds it up — the page feels like it has momentum.

import { useEffect, useRef, type ReactNode } from 'react';
import { getLenis, prefersReducedMotion } from '../../lib/motion';

export default function Marquee({ children, speed = 40, className = '' }: { children: ReactNode; speed?: number; className?: string }) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || prefersReducedMotion()) return;
    let x = 0;
    let last = performance.now();
    let raf = 0;
    let running = true;
    const io = new IntersectionObserver(([e]) => {
      const was = running;
      running = e.isIntersecting;
      if (running && !was) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    });
    io.observe(track);
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const boost = Math.min(6, Math.abs(getLenis()?.velocity ?? 0) * 0.25);
      x -= speed * (1 + boost) * dt;
      const half = track.scrollWidth / 2;
      if (half > 0 && -x >= half) x += half;
      track.style.transform = `translate3d(${x}px,0,0)`;
      if (running) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [speed]);

  return (
    <div className={`overflow-hidden ${className}`} aria-hidden="true">
      <div ref={trackRef} className="flex w-max will-change-transform">
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center">{children}</div>
      </div>
    </div>
  );
}
