// The charts draw in viewBox units. With a fixed 720-unit box a phone shrinks
// everything ~2.4×, so 11-unit tick labels end up ~4 px tall. Measuring the
// real width and drawing in that many units keeps text at its intended size on
// every screen; the desktop look (720 wide and up) is unchanged.

import { useLayoutEffect, useRef, useState } from 'react';

export const BASE_W = 720;

export function useChartWidth<T extends Element>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(BASE_W);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 0) setWidth(Math.min(BASE_W, w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

/** Narrow charts get a little shorter, but not proportionally — a 300 px wide
 *  chart at the desktop aspect ratio would be a thin strip. */
export function chartHeight(height: number, width: number): number {
  return Math.round(height * Math.min(1, Math.max(0.72, width / BASE_W)));
}
