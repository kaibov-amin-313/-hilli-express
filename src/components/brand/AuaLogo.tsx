// AUA wordmark, «Горизонт».
//
// Wide geometric letters with a single line in the status colour running
// through them. The line is the smog layer: it sits at the foot of the letters
// when the air is clean, climbs to the middle when it is moderate and up to the
// peaks of the A's when it is bad. A highlight sweeps along it every few
// seconds, like an instrument scan, and it draws itself in on first paint.
//
// The line is cut around the letters with an SVG mask rather than a background
// coloured halo, so the logo sits cleanly on the 3D scene or any other backdrop.

import { useEffect, useId } from 'react';
import { STATUS_HEX } from '../lottie/Lottie';

export type AirLevel = 'good' | 'mid' | 'bad';

// Letter geometry in a 166 × 52 box (cap height 10 → 50).
const SW = 10; // stroke weight of the letters
const A_W = 50;
const U_W = 40;
const GAP = 7;
const X0 = 6; // room for the line to run past the letters

function aPath(x: number): string {
  const top = 10;
  const base = 50;
  const cx = x + A_W / 2;
  const h = base - top;
  const ang = Math.atan2(h, A_W / 2);
  const tx = SW / Math.sin(ang);
  const innerTop = top + (tx * h) / (A_W / 2) / 2;
  const p = [
    [x, base],
    [cx, top],
    [x + A_W, base],
    [x + A_W - tx, base],
    [cx, innerTop],
    [x + tx, base],
  ];
  return 'M' + p.map(([a, b]) => `${a.toFixed(2)} ${b.toFixed(2)}`).join(' L') + 'Z';
}

function uPath(x: number): string {
  const r = (U_W - SW) / 2;
  const l = x + SW / 2;
  const rr = x + U_W - SW / 2;
  const y = 50 - SW / 2 - r;
  return `M${l} 10 V${y.toFixed(2)} A${r} ${r} 0 0 0 ${rr} ${y.toFixed(2)} V10`;
}

const A1 = aPath(X0);
const U = uPath(X0 + A_W + GAP);
const A2 = aPath(X0 + A_W + GAP + U_W + GAP);
const WIDTH = X0 * 2 + A_W * 2 + U_W + GAP * 2;

// Height of the smog line for each air level (y in the 52-unit box).
const LINE_Y: Record<AirLevel, number> = { good: 45, mid: 34, bad: 22 };

/** Accepts a status hex or the `var(--good|mid|bad)` the app passes around. */
export function levelFromColor(color: string): AirLevel {
  if (color === STATUS_HEX.bad || color.includes('--bad')) return 'bad';
  if (color === STATUS_HEX.mid || color.includes('--mid')) return 'mid';
  return 'good';
}

interface Props {
  level: AirLevel;
  height?: number;
  className?: string;
  /** Turn off the scan sweep (e.g. inside very small UI). */
  still?: boolean;
}

export default function AuaLogo({ level, height = 24, className, still }: Props) {
  const id = useId().replace(/:/g, '');
  const color = STATUS_HEX[level];
  const y = LINE_Y[level];
  const width = (height * WIDTH) / 52;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} 52`}
      width={width}
      height={height}
      className={`aua-logo ${className ?? ''}`}
      role="img"
      aria-label="AUA"
    >
      <defs>
        <mask id={`m${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width={WIDTH} height="52">
          <rect width={WIDTH} height="52" fill="#fff" />
          <g stroke="#000" strokeWidth="5" strokeLinejoin="miter">
            <path d={A1} fill="#000" />
            <path d={A2} fill="#000" />
          </g>
          <path d={U} fill="none" stroke="#000" strokeWidth={SW + 5} />
        </mask>
        <linearGradient id={`g${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* smog line: moves between levels, cut around the letters */}
      <g mask={`url(#m${id})`}>
        <g className="aua-logo__level" style={{ transform: `translateY(${y}px)` }}>
          <line
            className="aua-logo__line"
            x1="0"
            x2={WIDTH}
            y1="0"
            y2="0"
            stroke={color}
            strokeWidth="3"
            pathLength={1}
            style={{ transition: 'stroke 1.2s ease' }}
          />
          {!still && (
            <rect className="aua-logo__scan" x="-30" y="-1.5" width="30" height="3" fill={`url(#g${id})`} />
          )}
        </g>
      </g>

      <g fill="#f4f6f8">
        <path d={A1} />
        <path d={A2} />
      </g>
      <path d={U} fill="none" stroke="#f4f6f8" strokeWidth={SW} />
    </svg>
  );
}

export const AUA_LOGO_WIDTH = WIDTH;

// ---- favicon: a single A cut by the smog line, recoloured with the air ----

function faviconSvg(level: AirLevel): string {
  const color = STATUS_HEX[level];
  const y = { good: 47, mid: 38, bad: 28 }[level];
  // A scaled into a 64 box: x 10 → 54, cap 12 → 52
  const sw = 10;
  const top = 12;
  const base = 52;
  const x = 10;
  const w = 44;
  const cx = x + w / 2;
  const h = base - top;
  const tx = sw / Math.sin(Math.atan2(h, w / 2));
  const inner = top + (tx * h) / (w / 2) / 2;
  const a = `M${x} ${base} L${cx} ${top} L${x + w} ${base} L${(x + w - tx).toFixed(1)} ${base} L${cx} ${inner.toFixed(1)} L${(x + tx).toFixed(1)} ${base}Z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#05070a"/><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/><path d="${a}" stroke="#000" stroke-width="6" fill="#000"/></mask><path d="M4 ${y} H60" stroke="${color}" stroke-width="4.5" mask="url(#m)"/><path d="${a}" fill="#f4f6f8"/></svg>`;
}

export function useStatusFavicon(level: AirLevel): void {
  useEffect(() => {
    const href = 'data:image/svg+xml,' + encodeURIComponent(faviconSvg(level));
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      document.head.appendChild(link);
    }
    link.href = href;
  }, [level]);
}

export { faviconSvg };
