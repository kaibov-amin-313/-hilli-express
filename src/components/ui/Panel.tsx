// The small vocabulary every screen is built from: a titled glass panel, a KPI
// tile, a page header, a pill and a loading placeholder. Kept together because
// they are only meaningful as a set — changing the panel radius here changes
// every screen at once, which is the point.

import type { ReactNode } from 'react';
import { useRoute } from '../../lib/router';
import SplitText from '../fx/SplitText';
import Lottie, { type LottieName } from '../lottie/Lottie';

const SCREEN_ICON: Record<string, LottieName> = {
  map: 'target',
  forecast: 'graph',
  stations: 'signal',
  dashboard: 'pulse',
  about: 'radar',
};

const SCREEN_INDEX: Record<string, string> = {
  map: '02',
  forecast: '03',
  stations: '04',
  dashboard: '05',
  about: '06',
};

// Panels pick an instrument from their title when none is given, so every
// screen gets its line-art without each call site having to choose one.
const TITLE_ICON: [RegExp, LottieName][] = [
  [/аномал|тревог|опасн|событи/i, 'alert'],
  [/прогноз|динамик|ритм|точност|истори|модел/i, 'graph'],
  [/станц|пост|сеть|аптайм|связ|покрыт/i, 'signal'],
  [/ветер|погод|климат|проветр/i, 'wind'],
  [/здоров|сенсор|газ|канал|калибр/i, 'pulse'],
  [/район|карт|мест|адрес|гулят|прогулк|пойти/i, 'target'],
  [/выйти|окно|время|час/i, 'scan'],
  [/слои|город|пробк|строй/i, 'radar'],
  [/совет|рекоменд|взять|дыш|сигарет/i, 'lungs'],
  [/индекс|оценк|доля|сравн|рейтинг/i, 'gauge'],
];

function iconFor(title: ReactNode): LottieName | null {
  if (typeof title !== 'string') return null;
  for (const [re, name] of TITLE_ICON) if (re.test(title)) return name;
  return null;
}

/** A Lottie instrument inside HUD corner brackets. */
export function HudIcon({ name, size = 40, className = '' }: { name: LottieName; size?: number; className?: string }) {
  return (
    // `inline-block` is a utility, not part of .hud-icon, so a responsive
    // `hidden md:block` passed in can actually hide it on phones.
    <span className={`hud-icon inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
      <Lottie name={name} className="h-full w-full" />
    </span>
  );
}

interface PanelProps {
  /** Instrument in the header; inferred from the title when omitted, `false` for none. */
  icon?: LottieName | false;
  title?: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}

export function Panel({ title, sub, action, icon, children, className = '', id }: PanelProps) {
  const name = icon === false ? null : (icon ?? iconFor(title));
  return (
    <section id={id} className={`liquid-glass rounded-[20px] p-5 sm:p-7 ${className}`}>
      {(title || action) && (
        <header className="relative flex items-start gap-3.5 mb-5">
          {name && <HudIcon name={name} size={40} />}
          <div className="min-w-0 flex-1">
            {title && (
              <h2 className="flex items-center gap-2.5 text-lg font-medium tracking-[-0.02em] leading-snug">
                {!name && <span className="h-1.5 w-1.5 shrink-0 rotate-45" style={{ background: 'var(--status-c)' }} aria-hidden="true" />}
                {title}
              </h2>
            )}
            {sub && (
              <p className={`text-sm text-muted mt-1.5 leading-relaxed max-w-3xl ${action ? 'hidden sm:block' : ''}`}>{sub}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {/* On a phone a badge on the right squeezes the subtitle into a narrow
          column; there it runs full width under the header row instead. */}
      {sub && action && (
        <p className="sm:hidden text-sm text-muted -mt-2 mb-5 leading-relaxed">{sub}</p>
      )}
      {children}
    </section>
  );
}

interface StatTileProps {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  color?: string;
  trend?: number | null;
  icon?: LottieName;
}

export function StatTile({ label, value, unit, hint, color, trend, icon }: StatTileProps) {
  return (
    <div className="liquid-glass rounded-[18px] p-4 sm:p-5 flex flex-col gap-2 min-h-[132px]">
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-2xs uppercase tracking-[0.16em] text-muted">{label}</span>
        {icon && <HudIcon name={icon} size={34} />}
      </div>
      <span
        // A district name in a half-width tile on a phone doesn't fit at the
        // numeric size; long words step down instead of being clipped.
        className={`mt-auto font-display leading-none tracking-[-0.04em] tabular-nums ${
          typeof value === 'string' && value.length > 7 ? 'text-[clamp(12px,3.7vw,15px)] sm:text-xl md:text-2xl lg:text-[28px]' : 'text-2xl sm:text-[32px]'
        }`}
        style={color ? { color } : undefined}
      >
        {value}
        {unit && <span className="font-mono text-xs text-muted ml-1.5 tracking-normal">{unit}</span>}
      </span>
      {trend != null && (
        // Cleaner air is the good direction, so a falling number is green —
        // the opposite of the usual "up is good" convention.
        <span
          className="text-xs tabular-nums"
          style={{ color: trend > 0 ? 'var(--bad)' : trend < 0 ? 'var(--good)' : 'var(--muted)' }}
        >
          {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend)}% за сутки
        </span>
      )}
      {hint && <span className="text-xs text-muted leading-snug">{hint}</span>}
    </div>
  );
}

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  sub?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({ eyebrow, title, sub, children }: PageHeaderProps) {
  const { segments } = useRoute();
  const idx = SCREEN_INDEX[segments[0] ?? ''] ?? '01';
  return (
    <header className="pt-10 md:pt-16 mb-8 md:mb-12">
      <div className="flex items-center gap-4 font-mono text-2xs uppercase tracking-[0.2em] text-muted mb-6 md:mb-8">
        <span style={{ color: 'var(--status-c)' }}>({idx})</span>
        <span>{eyebrow}</span>
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
        <span className="hidden sm:inline">AUA / Алматы</span>
      </div>
      <div className="flex items-end justify-between gap-6">
        <SplitText as="h1" text={title} className="block fs-page uppercase min-w-0" />
        <HudIcon name={SCREEN_ICON[segments[0] ?? ''] ?? 'radar'} size={132} className="hidden md:block mb-1" />
      </div>
      {sub && (
        <div className="mt-6 md:mt-8 grid md:grid-cols-[1fr_minmax(0,520px)] gap-4">
          <span className="hidden md:block" aria-hidden="true" />
          <p className="text-gray-300 text-base md:text-md leading-relaxed" data-reveal>
            {sub}
          </p>
        </div>
      )}
      {children}
    </header>
  );
}

/** Chapter break inside a screen: index, a big title that rises on scroll,
 *  and an optional one-line note on the right. */
export function SectionHead({ index, title, note, icon }: { index: string; title: string; note?: ReactNode; icon?: LottieName }) {
  return (
    <div className="mt-16 md:mt-28 mb-2 md:mb-4">
      <div className="flex items-center gap-4 font-mono text-2xs uppercase tracking-[0.2em] text-muted mb-5">
        <span style={{ color: 'var(--status-c)' }}>({index})</span>
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_minmax(0,420px)] md:items-end">
        <div className="flex items-center gap-4 min-w-0">
          {icon && <HudIcon name={icon} size={64} className="hidden sm:block" />}
          <SplitText as="h2" text={title} onScroll className="block fs-section uppercase min-w-0" />
        </div>
        {note && <p className="text-sm md:text-base text-muted leading-relaxed" data-reveal>{note}</p>}
      </div>
    </div>
  );
}

export function Chip({
  children,
  color,
  onClick,
  active,
  title,
}: {
  children: ReactNode;
  color?: string;
  onClick?: () => void;
  active?: boolean;
  title?: string;
}) {
  // 30px tall is the right visual weight for a filter row, but it is under
  // both Apple's 44pt and Material's 48dp minimum — and on the map screen
  // these chips are the primary interaction. `tap-target` grows the hit area
  // to 44x44 with a centred pseudo-element, so the chip stays the same size on
  // screen and becomes reliably tappable. Static chips are labels, not
  // controls, so they do not get it.
  const cls =
    'inline-flex items-center gap-2 text-sm rounded-full px-3.5 py-1.5 border transition-colors ' +
    (active
      ? 'border-white bg-white text-black'
      : 'border-line bg-fill text-gray-300 hover:border-line-strong hover:text-white');
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${cls} tap-target cursor-pointer`}
      title={title}
    >
      {color && <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  ) : (
    <span className={cls} title={title}>
      {color && <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />}
      {children}
    </span>
  );
}

export function Skeleton({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`animate-pulse flex flex-col gap-2.5 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="h-3.5 rounded bg-fill-hover"
          style={{ width: `${100 - i * 12}%` }}
        />
      ))}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted py-6 text-center">{children}</p>;
}
