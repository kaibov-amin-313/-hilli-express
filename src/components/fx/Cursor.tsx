// Cursor follower: a ring that trails the pointer and swells over anything
// clickable, showing a one-word hint when the element provides one
// (`data-cursor="Открыть"`). The native cursor stays — the ring decorates, it
// never replaces. Also drives magnetic pull on `[data-magnetic]` elements.
// Desktop with a fine pointer only.

import { useEffect, useRef } from 'react';
import { gsap, hasFinePointer, prefersReducedMotion } from '../../lib/motion';

export default function Cursor() {
  const ringRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!hasFinePointer() || prefersReducedMotion()) return;
    const ring = ringRef.current!;
    const label = labelRef.current!;
    ring.style.display = 'flex';

    const xTo = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' });
    const yTo = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
    let magnet: HTMLElement | null = null;

    const onMove = (e: PointerEvent) => {
      xTo(e.clientX);
      yTo(e.clientY);

      const target = e.target as HTMLElement | null;
      const hit = target?.closest<HTMLElement>('a, button, [role="button"], select, label, [data-cursor]');
      const text = hit?.dataset.cursor ?? '';
      ring.dataset.state = hit ? (text ? 'label' : 'hover') : 'idle';
      label.textContent = text;

      const m = target?.closest<HTMLElement>('[data-magnetic]') ?? null;
      if (magnet && magnet !== m) {
        gsap.to(magnet, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
      }
      magnet = m;
      if (m) {
        const r = m.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        gsap.to(m, { x: dx * 0.3, y: dy * 0.3, duration: 0.4, ease: 'power3.out' });
      }
    };
    const onLeave = () => (ring.dataset.state = 'hidden');
    const onDown = () => ring.classList.add('is-down');
    const onUp = () => ring.classList.remove('is-down');

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  return (
    <div ref={ringRef} className="cursor-ring" data-state="hidden" aria-hidden="true" style={{ display: 'none' }}>
      <span ref={labelRef} />
    </div>
  );
}
