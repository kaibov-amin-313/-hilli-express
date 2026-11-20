#!/usr/bin/env node
// Запуск станции MQ-135 для демонстрации — одной командой, в двух режимах.
//
//   npm run station            сам выбирает: есть интернет → online, нет → local
//   npm run station:online     станция → ноутбук → MQTT → сервер на Render → aua-almaty.vercel.app
//   npm run station:local      сервер и сайт на этом ноутбуке, интернет не нужен
//
// Порт платы находится сам (/dev/cu.usbserial-*, cu.wchusbserial-*, cu.SLAB_*,
// cu.usbmodem*). Если плат несколько или порт другой — передай его последним
// аргументом:  npm run station:local -- /dev/cu.usbserial-110
//
// Serial Monitor в Arduino IDE должен быть закрыт: порт может читать только
// одна программа.

import { spawn, execFile } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BACKEND = join(ROOT, 'backend');
const LOCAL_DIST = join(ROOT, 'dist-local');
const API_PORT = 8080;
const WEB_PORT = 4173;
const LIVE_SITE = 'https://aua-almaty.vercel.app';

const args = process.argv.slice(2);
const modeArg = args.find((a) => ['online', 'local', 'auto'].includes(a)) ?? 'auto';
const portArg = args.find((a) => a.startsWith('/dev/'));
const rebuild = args.includes('--rebuild');

const say = (s) => console.log(`\x1b[36m[station]\x1b[0m ${s}`);
const fail = (s) => {
  console.log(`\x1b[31m[station] ${s}\x1b[0m`);
  process.exit(1);
};

function findPort() {
  if (portArg) {
    if (!existsSync(portArg)) fail(`порт ${portArg} не найден. Посмотри список: ls /dev/cu.*`);
    return portArg;
  }
  let names = [];
  try {
    names = readdirSync('/dev').filter((n) =>
      /^(cu|tty)\.(usbserial|wchusbserial|SLAB_USBtoUART|usbmodem)/.test(n) || /^ttyUSB\d+$/.test(n),
    );
  } catch {
    /* not a unix box */
  }
  // On a Mac each board shows up twice (cu.* and tty.*); cu.* is the one to read.
  const cu = names.filter((n) => !n.startsWith('tty.'));
  const list = (cu.length ? cu : names).sort();
  if (!list.length)
    fail('плата не найдена. Подключи станцию по USB (кабель с данными, не только зарядка) и запусти снова.');
  if (list.length > 1) say(`найдено несколько портов: ${list.join(', ')} — беру первый`);
  return `/dev/${list[0]}`;
}

async function online() {
  try {
    const r = await fetch(LIVE_SITE, { method: 'HEAD', signal: AbortSignal.timeout(6000) });
    return r.ok || r.status < 500;
  } catch {
    return false;
  }
}

const children = [];
function run(cmd, cmdArgs, opts = {}) {
  const p = spawn(cmd, cmdArgs, { stdio: 'inherit', ...opts });
  children.push(p);
  return p;
}
function shutdown() {
  for (const c of children) if (!c.killed) c.kill('SIGINT');
  setTimeout(() => process.exit(0), 500);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function needInstall(dir, what) {
  if (!existsSync(join(dir, 'node_modules')))
    fail(`нет зависимостей ${what}. Пока есть интернет, выполни: cd ${dir} && npm install`);
}

// The local build bakes in the API address, so it is separate from dist/ (the
// Vercel build) and rebuilt when the frontend sources are newer than it.
function newestMtime(dir) {
  let t = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    t = Math.max(t, s.isDirectory() ? newestMtime(p) : s.mtimeMs);
  }
  return t;
}
function buildLocalSite() {
  const built = existsSync(join(LOCAL_DIST, 'index.html'));
  const stale = built && newestMtime(join(ROOT, 'src')) > statSync(join(LOCAL_DIST, 'index.html')).mtimeMs;
  if (built && !stale && !rebuild) return Promise.resolve();
  say(built ? 'исходники сайта изменились — пересобираю локальную версию…' : 'первый запуск — собираю локальную версию сайта (около минуты)…');
  return new Promise((resolve) => {
    const p = spawn('npx', ['vite', 'build', '--outDir', LOCAL_DIST, '--emptyOutDir'], {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, VITE_API_URL: `http://localhost:${API_PORT}` },
    });
    p.on('exit', (code) => (code === 0 ? resolve() : fail('сборка сайта не удалась (текст ошибки выше)')));
  });
}

async function waitFor(url, seconds) {
  for (let i = 0; i < seconds; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (r.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function startLocal(port) {
  needInstall(ROOT, 'сайта');
  needInstall(BACKEND, 'сервера');
  await buildLocalSite();

  say(`локальный режим: станция ${port} → сервер на ноутбуке → сайт http://localhost:${WEB_PORT}`);
  run('npx', ['tsx', 'src/server.ts'], {
    cwd: BACKEND,
    env: {
      ...process.env,
      PORT: String(API_PORT),
      MQ135_SERIAL_PORT: port,
      MQTT_ENABLED: 'false',
      CORS_ORIGIN: `http://localhost:${WEB_PORT},http://127.0.0.1:${WEB_PORT},http://localhost:5173`,
      DATABASE_PATH: './aua-local.db',
      LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
    },
  });
  if (!(await waitFor(`http://localhost:${API_PORT}/api/health`, 60)))
    fail(`сервер не поднялся на порту ${API_PORT} за минуту (ошибка выше; порт не занят другой программой?)`);

  run('npx', ['vite', 'preview', '--outDir', LOCAL_DIST, '--port', String(WEB_PORT), '--strictPort'], { cwd: ROOT });
  if (await waitFor(`http://localhost:${WEB_PORT}`, 20)) {
    say(`готово → http://localhost:${WEB_PORT}  (остановить: Ctrl+C)`);
    say('без интернета не будет фона карты и данных Open-Meteo; станция, расчёты и все экраны работают');
    if (process.platform === 'darwin') execFile('open', [`http://localhost:${WEB_PORT}`]);
  }
}

function startOnline(port) {
  needInstall(BACKEND, 'сервера (мост MQTT)');
  say(`онлайн-режим: станция ${port} → MQTT → aua-backend.onrender.com → ${LIVE_SITE}`);
  run('node', [join(BACKEND, 'scripts', 'usb-bridge.mjs'), port], { cwd: BACKEND });
}

const port = findPort();
let mode = modeArg;
if (mode === 'auto') {
  say('проверяю интернет…');
  mode = (await online()) ? 'online' : 'local';
  say(mode === 'online' ? 'интернет есть' : 'интернета нет');
}
if (mode === 'online') startOnline(port);
else await startLocal(port);
