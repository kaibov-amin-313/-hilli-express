// App shell. Five screens behind a tab bar, plus the pieces that must survive
// navigation: the status colour that tints the whole UI, the atmospheric
// background, and the chat widget.
//
// The old single-page landing now lives at /about, reachable from the footer —
// its content still explains the project, but it is no longer the thing people
// land in when they only want to know whether to go outside.

import { useEffect } from 'react';
import Preloader from './components/fx/Preloader';
import PageCurtain from './components/fx/PageCurtain';
import Cursor from './components/fx/Cursor';
import Marquee from './components/fx/Marquee';
import { startSmoothScroll } from './lib/motion';
import { useAutoReveal, usePointerSpotlight } from './lib/useReveal';
import { asKey } from './lib/api';
import { statusCopyFor } from './lib/air';
import { AppStateProvider, useApp } from './lib/appState';
import { useRoute, navigate } from './lib/router';
import AppNav, { TABS } from './components/nav/AppNav';
import ChatWidget from './components/ChatWidget';
import NowPage from './pages/NowPage';
import MapPage from './pages/MapPage';
import ForecastPage from './pages/ForecastPage';
import StationsPage from './pages/StationsPage';
import DashboardPage from './pages/DashboardPage';
import AboutPage from './pages/AboutPage';

function Screen() {
  const { segments } = useRoute();
  switch (segments[0]) {
    case undefined:
      return <NowPage />;
    case 'map':
      return <MapPage />;
    case 'forecast':
      return <ForecastPage />;
    case 'stations':
      return <StationsPage />;
    case 'dashboard':
      return <DashboardPage />;
    case 'about':
      return <AboutPage />;
    default:
      return <NotFound />;
  }
}

function NotFound() {
  return (
    <div className="pt-24 pb-16 text-center">
      <p className="fs-display mb-6">404</p>
      <p className="text-md mb-6 text-muted">Такого экрана нет.</p>
      <button
        type="button"
        onClick={() => navigate('/')}
        className="bg-white text-black px-6 py-3 rounded-full text-sm font-medium"
      >
        На главную
      </button>
    </div>
  );
}

function Shell() {
  const { place, status } = useApp();
  const { path } = useRoute();
  const copy = statusCopyFor(status ? asKey(status.status) : 'good');

  // One CSS variable drives every accent in the app — nav highlight, chart
  // lines, the aurora, the curtain between screens — so the whole interface
  // shifts colour with the air.
  useEffect(() => {
    document.documentElement.style.setProperty('--status-c', copy.cssVar);
  }, [copy.cssVar]);

  useEffect(() => {
    startSmoothScroll();
  }, []);

  useAutoReveal(path);
  usePointerSpotlight();

  return (
    <>
      <Preloader ready={status != null} />
      <PageCurtain />
      <Cursor />
      <div className="haze" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />

      <div className="relative z-[1] min-h-screen flex flex-col">
        <AppNav statusColor={copy.cssVar} statusLabel={copy.idx} />

        <main className="flex-1 w-full max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-10 md:pt-20">
          <Screen />
        </main>

        <Footer />

        {/* Clearance for the floating bottom dock on phones. */}
        <div className="h-24 md:h-0" aria-hidden="true" />
      </div>

      <ChatWidget place={place} />
    </>
  );
}

function Footer() {
  return (
    <footer className="relative mt-24 border-t border-line-soft overflow-hidden">
      <Marquee speed={30} className="py-6 border-b border-line-soft">
        {['Можно ли сейчас гулять?', 'PM2.5', 'Станции на ESP8266', 'Прогноз 6 часов', 'Алматы', 'MQ-135'].map((t) => (
          <span key={t} className="flex items-center font-display text-2xl md:text-4xl uppercase tracking-[-0.04em] text-white/80">
            <span className="px-6 md:px-10">{t}</span>
            <span className="h-2 w-2 rotate-45" style={{ background: 'var(--status-c)' }} />
          </span>
        ))}
      </Marquee>

      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-10 pt-14 pb-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="font-mono text-2xs uppercase tracking-[0.2em] text-muted mb-4">(AUA) — проект</p>
            <p className="text-lg md:text-xl leading-snug max-w-md tracking-[-0.01em]">
              Гиперлокальный мониторинг воздуха: дешёвые станции, открытые модели и честная оценка для каждого района Алматы.
            </p>
          </div>
          <nav aria-label="Экраны">
            <p className="font-mono text-2xs uppercase tracking-[0.2em] text-muted mb-4">Экраны</p>
            <ul className="grid gap-2">
              {TABS.map((t, i) => (
                <li key={t.path}>
                  <button type="button" onClick={() => navigate(t.path)} className="u-line text-md text-gray-300 hover:text-white">
                    <span className="font-mono text-2xs text-muted mr-2">0{i + 1}</span>
                    {t.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <p className="font-mono text-2xs uppercase tracking-[0.2em] text-muted mb-4">Ещё</p>
            <ul className="grid gap-2">
              <li>
                <button type="button" onClick={() => navigate('/about')} className="u-line text-md text-gray-300 hover:text-white">
                  О проекте
                </button>
              </li>
              <li>
                <a
                  href="https://github.com/kaibov-amin-313/-hilli-express"
                  target="_blank"
                  rel="noreferrer"
                  className="u-line text-md text-gray-300 hover:text-white"
                >
                  Исходный код ↗
                </a>
              </li>
            </ul>
          </div>
        </div>

        <p
          className="mt-16 font-display uppercase leading-[0.78] tracking-[-0.08em] text-stroke select-none text-center"
          style={{ fontSize: 'clamp(110px, 31vw, 520px)' }}
          aria-hidden="true"
        >
          AUA
        </p>

        <div className="mt-6 flex flex-wrap justify-between gap-3 font-mono text-2xs uppercase tracking-[0.16em] text-muted">
          <span>© {new Date().getFullYear()} AUA · Алматы</span>
          <span>Индикатор, не медицинский прибор</span>
          <span>43.24°N 76.89°E</span>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <AppStateProvider>
      <Shell />
    </AppStateProvider>
  );
}
