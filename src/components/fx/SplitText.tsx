// Headline that rises into place letter by letter, each glyph sliding up out of
// its own mask. Words stay unbreakable so Russian lines wrap between words,
// never inside one. Re-plays whenever the text changes (district switch,
// verdict change), which turns a data update into a moment.

import { useLayoutEffect, useRef, type CSSProperties, type ElementType } from 'react';
import { gsap, prefersReducedMotion } from '../../lib/motion';

interface Props {
  text: string;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  delay?: number;
  stagger?: number;
  /** Start only once the element scrolls into view. */
  onScroll?: boolean;
}

export default function SplitText({
  text,
  as: Tag = 'span',
  className = '',
  style,
  delay = 0,
  stagger = 0.028,
  onScroll = false,
}: Props) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const chars = el.querySelectorAll<HTMLElement>('[data-ch]');
    const ctx = gsap.context(() => {
      gsap.fromTo(
        chars,
        { yPercent: 115, rotate: 6 },
        {
          yPercent: 0,
          rotate: 0,
          duration: 1.1,
          ease: 'expo.out',
          stagger,
          delay,
          scrollTrigger: onScroll ? { trigger: el, start: 'top 88%', once: true } : undefined,
        },
      );
    }, el);
    return () => ctx.revert();
  }, [text, delay, stagger, onScroll]);

  const words = text.split(' ');
  return (
    <Tag ref={ref} className={className} style={style}>
      <span className="sr-only">{text}</span>
      {words.map((word, wi) => (
        <span key={wi} className="inline-block whitespace-nowrap" aria-hidden="true">
          {Array.from(word).map((ch, ci) => (
            <span key={ci} className="inline-block overflow-hidden align-bottom pb-[0.08em] -mb-[0.08em]">
              <span data-ch className="inline-block will-change-transform">
                {ch}
              </span>
            </span>
          ))}
          {wi < words.length - 1 && <span className="inline-block">&nbsp;</span>}
        </span>
      ))}
    </Tag>
  );
}
