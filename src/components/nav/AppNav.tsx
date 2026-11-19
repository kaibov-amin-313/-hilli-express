// One navigation model, two presentations.
//
// Desktop: a fixed bar floating over the page — transparent over the hero,
// it condenses into a dark plate once the page scrolls and slides out of the
// way while reading downward, back on the first upward flick. Numbered links
// in the instrument's mono voice; a live Almaty clock and the air verdict on
// the right so the answer is on screen from every route.
//
// Phone: a floating tab dock within thumb reach.

import AuaLogo, { levelFromColor, useStatusFavicon } from '../brand/AuaLogo';
import { useEffect, useState, type ComponentType } from 'react';
import { useRoute, navigate } from '../../lib/router';
import { DashboardIcon, ForecastIcon, MapIcon, NowIcon, StationsIcon } from './icons';

interface Tab {
  path: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
}

export const TABS: Tab[] = [
  { path: '/', label: 'Сейчас', Icon: NowIcon },
  { path: '/map', label: 'Карта', Icon: MapIcon },
  { path: '/forecast', label: 'Прогноз', Icon: ForecastIcon },
  { path: '/stations', label: 'Станции', Icon: StationsIcon },
  { path: '/dashboard', label: 'Дэшборд', Icon: DashboardIcon },
];

/** `/stations/aua-medeu-1` should still light up the Станции tab. */
function isActive(tabPath: string, path: string): boolean {
  if (tabPath === '/') return path === '/';
  return path === tabPath || path.startsWith(`${tabPath}/`);
}

interface AppNavProps {
  statusColor: string;
  statusLabel: string;
}

function useAlmatyClock(): string {
  const fmt = () =>
    new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Almaty' });
  const [t, setT] = useState(fmt);
  useEffect(() => {
    const id = window.setInterval(() => setT(fmt()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  return t;
}

function useScrollState(): { scrolled: boolean; hidden: boolean } {
  const [state, setState] = useState({ scrolled: false, hidden: false });
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const goingDown = y > last + 4;
      const goingUp = y < last - 4;
      setState((s) => {
        const scrolled = y > 40;
        const hidden = y > 400 && goingDown ? true : goingUp || y < 400 ? false : s.hidden;
        return s.scrolled === scrolled && s.hidden === hidden ? s : { scrolled, hidden };
      });
      last = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return state;
}

export default function AppNav({ statusColor, statusLabel }: AppNavProps) {
  useStatusFavicon(levelFromColor(statusColor));
  const { path } = useRoute();
  const clock = useAlmatyClock();
  const { scrolled, hidden } = useScrollState();

  return (
    <>
      {/* Desktop / tablet: floating top bar */}
      <header
        className="hidden md:block fixed top-0 inset-x-0 z-[900] px-6 lg:px-10 pt-4 transition-transform duration-700"
        style={{
          transform: hidden ? 'translateY(-120%)' : 'none',
          transitionTimingFunction: 'cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <nav
          className={`max-w-[1500px] mx-auto flex items-center gap-6 rounded-2xl px-5 py-3 transition-all duration-700 ${
            scrolled ? 'liquid-glass liquid-glass--solid' : 'border border-transparent'
          }`}
          data-no-reveal
        >
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 shrink-0"
            data-magnetic
            aria-label="AUA — на главную"
          >
            <AuaLogo level={levelFromColor(statusColor)} height={22} />
          </button>

          <div className="flex items-center gap-1 lg:gap-2 mx-auto">
            {TABS.map(({ path: p, label }, i) => {
              const active = isActive(p, path);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => navigate(p)}
                  aria-current={active ? 'page' : undefined}
                  className={`group relative flex items-baseline gap-1.5 px-3 py-2 text-sm transition-colors ${
                    active ? 'text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="font-mono text-[10px] tracking-wider" style={{ color: active ? statusColor : undefined }}>
                    0{i + 1}
                  </span>
                  {label}
                  <span
                    className="absolute left-3 right-3 -bottom-0.5 h-px origin-left transition-transform duration-500 group-hover:scale-x-100"
                    style={{
                      background: active ? statusColor : 'currentColor',
                      transform: active ? 'scaleX(1)' : 'scaleX(0)',
                      transitionTimingFunction: 'cubic-bezier(0.16,1,0.3,1)',
                    }}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>

          <div className="hidden lg:flex items-center gap-4 shrink-0 font-mono text-2xs uppercase tracking-[0.14em] text-muted">
            <span className="tabular-nums">Алматы {clock}</span>
            <span
              className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-white"
              style={{ borderColor: `color-mix(in srgb, ${statusColor} 45%, transparent)` }}
            >
              <span className="live-dot" style={{ width: 6, height: 6 }} />
              {statusLabel}
            </span>
          </div>
        </nav>
      </header>

      {/* Mobile: floating dock */}
      <div
        className="md:hidden fixed bottom-0 inset-x-0 z-[900] px-3"
        style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))' }}
      >
        <nav className="liquid-glass liquid-glass--solid rounded-[22px]" data-no-reveal>
          <div className="grid grid-cols-5">
            {TABS.map(({ path: p, label, Icon }) => {
              const active = isActive(p, path);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => navigate(p)}
                  aria-current={active ? 'page' : undefined}
                  className="relative flex flex-col items-center gap-1 pt-2.5 pb-2 transition-colors"
                  style={{ color: active ? '#fff' : 'var(--muted)' }}
                >
                  <span
                    className="absolute top-1.5 h-8 w-12 rounded-xl transition-opacity duration-500"
                    style={{ background: `color-mix(in srgb, ${statusColor} 18%, transparent)`, opacity: active ? 1 : 0 }}
                    aria-hidden="true"
                  />
                  <Icon className="relative w-[21px] h-[21px]" />
                  <span className="relative text-2xs leading-none">{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </>
  );
}
