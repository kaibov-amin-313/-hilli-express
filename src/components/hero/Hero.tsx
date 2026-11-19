// The opening shot.
//
// The verdict is the headline, set huge, rising in letter by letter. Behind
// it the night city on video, and over the video the air itself: a field of
// particles whose density is the real PM2.5 at the chosen place, tinted with
// the status colour. A clean evening is a few slow motes; a smog evening is a
// haze you can see before you read a number.
//
// Below the verdict, the numbers that back it up are laid out like an
// instrument panel — mono labels, hairline rules, no cards — so the first
// screen is both the poster and the proof the network is running.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { api, aqiToPm, asKey, type MlForecast, type Station, type StatusKey } from '../../lib/api';
import { statusCopyFor } from '../../lib/air';
import { useApp } from '../../lib/appState';
import { navigate } from '../../lib/router';
import { gsap, prefersReducedMotion, scrollToTarget } from '../../lib/motion';
import Sparkline from '../charts/Sparkline';
import AlmatyScene, { type SceneStation } from './AlmatyScene';
import HudFrame from './HudFrame';
import { aqiBand } from '../charts/primitives';
import { STATUS_HEX } from '../lottie/Lottie';
import SplitText from '../fx/SplitText';

const HERO_TITLE: Record<StatusKey, [string, string]> = {
  good: ['Можно', 'гулять'],
  mid: ['Недолго', 'на воздухе'],
  bad: ['Лучше', 'дома'],
};

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/** A number that counts to its new value instead of jumping. */
function Counter({ value }: { value: number | null }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef({ v: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value == null) {
      el.textContent = '—';
      return;
    }
    if (prefersReducedMotion()) {
      el.textContent = String(Math.round(value));
      return;
    }
    const t = gsap.to(shown.current, {
      v: value,
      duration: 1.8,
      ease: 'expo.out',
      delay: 0.3,
      onUpdate: () => {
        el.textContent = String(Math.round(shown.current.v));
      },
    });
    return () => {
      t.kill();
    };
  }, [value]);
  return <span ref={ref} className="tabular-nums">—</span>;
}

/** PM2.5 on the WHO scale, with a marker where we are now. */
function WhoScale({ pm }: { pm: number | null }) {
  const max = 100;
  const pos = pm == null ? 0 : Math.min(pm / max, 1) * 100;
  const stops = [
    { at: 15, label: '15' },
    { at: 35, label: '35' },
    { at: 75, label: '75' },
  ];
  return (
    <div className="w-full">
      <div className="relative h-[3px] rounded-full overflow-visible"
        style={{
          background:
            'linear-gradient(90deg, var(--good) 0%, var(--good) 15%, var(--mid) 15%, var(--mid) 35%, color-mix(in srgb, var(--bad) 70%, var(--mid)) 35%, color-mix(in srgb, var(--bad) 70%, var(--mid)) 75%, var(--bad) 75%)',
          opacity: 0.9,
        }}
      >
        {pm != null && (
          <span
            className="absolute -top-[7px] h-[17px] w-[2px] bg-white transition-[left] duration-1000"
            style={{ left: `${pos}%`, boxShadow: '0 0 12px #fff' }}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="relative mt-2 h-4 font-mono text-[10px] text-muted">
        <span className="absolute left-0">0</span>
        {stops.map((s) => (
          <span key={s.at} className="absolute -translate-x-1/2" style={{ left: `${s.at}%` }}>
            {s.label}
          </span>
        ))}
        <span className="absolute right-0">100+</span>
      </div>
    </div>
  );
}

export default function Hero() {
  const { status, statusLoading, place, devices } = useApp();
  const [forecast, setForecast] = useState<MlForecast | null>(null);
  const [introDone, setIntroDone] = useState(() => {
    try {
      return sessionStorage.getItem('aua.intro.v1') === '1' || prefersReducedMotion();
    } catch {
      return true;
    }
  });
  const sectionRef = useRef<HTMLElement>(null);
  const progress = useRef({ current: 0 }).current;
  const [stations, setStations] = useState<Station[]>([]);

  useEffect(() => {
    let alive = true;
    const load = () =>
      void api
        .stations()
        .then((s) => alive && setStations(s))
        .catch(() => {});
    load();
    const id = window.setInterval(load, 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (introDone) return;
    const done = () => setIntroDone(true);
    window.addEventListener('aua:intro-done', done);
    return () => window.removeEventListener('aua:intro-done', done);
  }, [introDone]);

  useEffect(() => {
    if (!place) return;
    let alive = true;
    void api
      .mlForecast(place, 6)
      .then((f) => alive && setForecast(f))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [place]);

  // Scroll choreography: the verdict drifts up and dissolves, the video pushes
  // in, as if the camera is moving through the haze toward the details below.
  useLayoutEffect(() => {
    const el = sectionRef.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.to('[data-hero-title]', {
        yPercent: -35,
        opacity: 0.1,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: true },
      });
      gsap.to(progress, {
        current: 1,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: 0.6 },
      });
      gsap.from('[data-hero-fade]', {
        opacity: 0,
        y: 24,
        duration: 1.2,
        ease: 'expo.out',
        stagger: 0.08,
        delay: 0.5,
      });
    }, el);
    return () => ctx.revert();
  }, [introDone]);

  const key: StatusKey = status ? asKey(status.status) : 'good';
  const copy = statusCopyFor(key);
  const [line1, line2] = HERO_TITLE[key];
  const ready = status != null;

  const pm25 = status?.fusion?.pm25 ?? status?.external.air_quality?.pm2_5 ?? null;
  const weather = status?.external.weather ?? null;
  // Smog density: PM2.5 when the model answers, otherwise the network's own
  // composite converted to a PM2.5 equivalent, so the scene still reflects the air.
  const scenePm = pm25 ?? (status ? aqiToPm(status.local.aqi_composite) : null);
  const sceneStations: SceneStation[] = stations.map((st) => ({
    id: st.id,
    name: st.name,
    lat: st.lat,
    lng: st.lng,
    color: st.reading ? STATUS_HEX[aqiBand(st.reading.aqi_composite)] : '#8d96a2',
    value: st.reading ? `AQI ${Math.round(st.reading.aqi_composite)}` : st.online ? 'на связи' : 'нет связи',
    isDemo: st.is_demo,
  }));
  const nearest = status?.local.nearest_post ?? null;
  const points = forecast?.points ?? [];
  const last = points[points.length - 1] ?? null;

  const cells = [
    {
      label: 'Через 6 часов',
      value: last ? String(last.aqi) : '—',
      unit: 'AQI',
      extra:
        points.length > 1 ? (
          <Sparkline values={points.map((p) => p.aqi)} color={copy.cssVar} width={88} height={22} />
        ) : null,
    },
    {
      label: 'Безопасно на улице',
      value: status ? `~${status.max_safe_duration_min}` : '—',
      unit: 'мин',
    },
    {
      label: 'Ближайший пост',
      value: nearest ? nearest.name : '—',
      unit: nearest ? `${nearest.distance_km} км` : '',
      small: true,
    },
    {
      label: 'Погода',
      value: weather ? `${Math.round(weather.temperature_c)}°` : '—',
      unit: weather ? `${Math.round(weather.humidity)} % влажн.` : '',
    },
  ];

  return (
    <section
      ref={sectionRef}
      className="relative full-bleed md:-mt-20 min-h-[100svh] overflow-hidden flex flex-col"
      aria-label="Оценка воздуха сейчас"
    >
      {/* ── 3D scene + HUD ──────────────────────────────────────── */}
      <AlmatyScene
        stations={sceneStations}
        pm={scenePm}
        color={STATUS_HEX[key]}
        progress={progress}
        className="absolute inset-0 z-0"
      />
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(5,6,8,0.88) 0%, rgba(5,6,8,0.5) 32%, rgba(5,6,8,0) 58%), radial-gradient(40% 35% at 92% 78%, rgba(5,6,8,0.75), transparent 70%), linear-gradient(180deg, rgba(5,6,8,0.6) 0%, transparent 20%, transparent 66%, var(--bg) 100%)',
        }}
        aria-hidden="true"
      />
      <HudFrame />

      {/* ── Content ───────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 flex flex-col w-full max-w-[1500px] mx-auto px-5 sm:px-6 lg:px-10 pt-8 md:pt-32 pb-8">
        {/* Meta row */}
        <div data-hero-fade className="flex items-center justify-between gap-4 font-mono text-2xs uppercase tracking-[0.18em] text-white/60">
          <span className="flex items-center gap-3 min-w-0">
            <span className="md:hidden font-display text-lg normal-case tracking-[-0.06em] text-white">AUA</span>
            <span style={{ color: copy.cssVar }}>(01)</span>
            <span className="truncate">{place?.label ?? 'Алматы'}</span>
          </span>
          <span className="flex items-center gap-2.5 shrink-0">
            <span className="live-dot" style={{ width: 6, height: 6 }} />
            {status ? `Обновлено ${hhmm(status.ts)}` : statusLoading ? 'Считаем…' : 'Нет данных'}
          </span>
        </div>

        {/* Verdict */}
        <div data-hero-title className="flex-1 flex flex-col justify-center py-10 md:py-8">
          <p data-hero-fade className="font-mono text-xs uppercase tracking-[0.2em] text-white/60 mb-5 md:mb-7">
            Можно ли сейчас гулять с ребёнком?
          </p>
          <h1 className="fs-display uppercase" aria-live="polite">
            {introDone && (
              <>
                <SplitText text={ready ? line1 : 'Проверяем'} className="block text-white" delay={0.1} />
                <SplitText
                  text={ready ? line2 : 'воздух'}
                  className="block"
                  style={{ color: ready ? copy.cssVar : 'rgba(255,255,255,0.45)' }}
                  delay={0.35}
                />
              </>
            )}
          </h1>
        </div>

        {/* Lower deck: what it means + the reading itself */}
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div data-hero-fade className="max-w-xl">
            <p className="text-md md:text-lg leading-relaxed text-white/80">
              {ready ? copy.sub : statusLoading ? 'Считаем оценку по вашему району…' : 'Выберите район или введите адрес ниже.'}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/map')}
                data-magnetic
                data-cursor="Карта"
                className="group flex items-center gap-3 rounded-full bg-white py-2 pl-6 pr-2 text-md font-medium text-black"
              >
                Смотреть карту
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white transition-transform duration-500 group-hover:rotate-45">
                  <ArrowUpRight size={16} />
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('place-picker');
                  if (el) scrollToTarget(el);
                }}
                data-magnetic
                className="rounded-full border border-white/25 px-6 py-3 text-md text-white hover:border-white transition-colors"
              >
                Сменить район
              </button>
            </div>
          </div>

          <div data-hero-fade className="lg:text-right lg:min-w-[380px]">
            <p className="font-mono text-2xs uppercase tracking-[0.2em] text-white/60">
              PM2.5 сейчас · µg/m³
            </p>
            <p
              className="font-display leading-[0.85] tracking-[-0.06em] my-2"
              style={{
                fontSize: pm25 == null ? 'clamp(56px, 6vw, 96px)' : 'clamp(84px, 11vw, 190px)',
                color: pm25 == null ? 'rgba(255,255,255,0.3)' : copy.cssVar,
              }}
            >
              <Counter value={pm25} />
            </p>
            <div className="lg:ml-auto lg:max-w-[380px]">
              <WhoScale pm={pm25} />
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
                пороги ВОЗ · {devices.length || '—'} станций в сети
              </p>
            </div>
          </div>
        </div>

        {/* Instrument strip */}
        <dl
          data-hero-fade
          className="mt-10 grid grid-cols-2 lg:grid-cols-4 border-t border-white/15"
        >
          {cells.map((c, i) => (
            <div
              key={c.label}
              className={`py-4 pr-4 border-white/15 ${i % 2 === 1 ? 'pl-4 border-l border-white/15' : ''} ${
                i >= 2 ? 'border-t border-white/15 lg:border-t-0' : ''
              } ${i === 2 ? 'lg:pl-4 lg:border-l' : ''}`}
            >
              <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">{c.label}</dt>
              <dd className="mt-2 flex items-end gap-2 flex-wrap">
                <span className={`font-display tracking-[-0.04em] leading-none ${c.small ? 'text-md md:text-lg' : 'text-xl md:text-2xl'}`}>
                  {c.value}
                </span>
                {c.unit && <span className="font-mono text-2xs text-white/55 mb-0.5">{c.unit}</span>}
                {c.extra && <span className="ml-auto self-center">{c.extra}</span>}
              </dd>
            </div>
          ))}
        </dl>

        <div data-hero-fade className="hidden md:flex mt-6 items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">
          <ArrowDown size={12} className="animate-bounce" />
          Листайте — откуда оценка и что делать
        </div>
      </div>
    </section>
  );
}
