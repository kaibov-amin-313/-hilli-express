// The instrument frame over the 3D scene: corner brackets, edge rulers, a
// faint crosshair, compass and scale. Purely decorative — every number the
// reader needs lives in the content layer, not here.

import { useEffect, useState } from 'react';

function useTicker(): string {
  const [t, setT] = useState('');
  useEffect(() => {
    const f = () => {
      const d = new Date();
      setT(d.toLocaleTimeString('ru-RU', { timeZone: 'Asia/Almaty', hour12: false }));
    };
    f();
    const id = window.setInterval(f, 1000);
    return () => window.clearInterval(id);
  }, []);
  return t;
}

export default function HudFrame() {
  const time = useTicker();
  return (
    <div className="hud absolute inset-0 z-[5] pointer-events-none" aria-hidden="true">
      {/* corner brackets */}
      <span className="hud-corner left-3 top-3 md:left-6 md:top-24 border-l border-t" />
      <span className="hud-corner right-3 top-3 md:right-6 md:top-24 border-r border-t" />
      <span className="hud-corner left-3 bottom-3 md:left-6 md:bottom-6 border-l border-b" />
      <span className="hud-corner right-3 bottom-3 md:right-6 md:bottom-6 border-r border-b" />

      {/* top centre: bearing */}
      <div className="hidden md:flex absolute left-1/2 top-[92px] -translate-x-1/2 items-center gap-3">
        <span className="hud-text">З</span>
        <span className="flex items-end gap-[6px]">
          {Array.from({ length: 25 }, (_, i) => (
            <span key={i} className="block w-px bg-white/35" style={{ height: i === 12 ? 12 : i % 4 === 0 ? 8 : 4 }} />
          ))}
        </span>
        <span className="hud-text">В</span>
        <span className="hud-text absolute left-1/2 -translate-x-1/2 -bottom-4 text-white/80">ЮГ 180°</span>
      </div>

      {/* bottom-right: scale + clock */}
      <div className="hidden md:flex absolute right-10 bottom-10 flex-col items-end gap-2">
        <span className="hud-text tabular-nums">REC ● {time} ALA</span>
        <span className="flex items-center gap-2">
          <span className="hud-text">0</span>
          <span className="block h-[5px] w-24 border-x border-b border-white/50" />
          <span className="hud-text">5 км</span>
        </span>
      </div>
    </div>
  );
}
