#!/usr/bin/env node
// USB → MQTT bridge for the MQ-135 station.
//
// The station has no internet of its own (no Wi-Fi at the venue, no phone
// hotspot), but the laptop does. Plug the board into the laptop, run this, and
// every packet the firmware prints as `[pub] {...}` is forwarded to the same
// MQTT topic the board would have used. The deployed backend on Render picks
// it up exactly as before, so the live site shows the real readings.
//
// It also pings the backend every 10 minutes so the free Render instance does
// not fall asleep in the middle of the demo.
//
// Usage (from the backend folder):
//   node scripts/usb-bridge.mjs /dev/cu.usbserial-110
//   node scripts/usb-bridge.mjs /dev/cu.usbserial-110 --dry   (print only, no MQTT)
//
// Optional env: MQTT_BROKER_URL, MQ135_TOPIC, API_URL, BAUD.

import { createReadStream, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import mqtt from 'mqtt';

const port = process.argv[2];
const dry = process.argv.includes('--dry');
const BROKER = process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883';
const TOPIC = process.env.MQ135_TOPIC || 'almaty/auezov/mkr12/station1/air';
const API = process.env.API_URL || 'https://aua-backend.onrender.com';
const BAUD = process.env.BAUD || '115200';
const PACKET = /^\[pub\]\s+(\{.*\})\s*$/;

if (!port) {
  console.error('Укажи порт платы, например: node scripts/usb-bridge.mjs /dev/cu.usbserial-110');
  console.error('Список портов: ls /dev/cu.*');
  process.exit(1);
}

const t = () => new Date().toLocaleTimeString('ru-RU');
let sent = 0;

// ---- MQTT
let client = null;
if (!dry) {
  client = mqtt.connect(BROKER, {
    clientId: `aua-usb-bridge-${process.pid}`,
    reconnectPeriod: 5000,
    connectTimeout: 15000,
  });
  client.on('connect', () => console.log(`${t()}  [mqtt] подключено к ${BROKER}, топик ${TOPIC}`));
  client.on('reconnect', () => console.log(`${t()}  [mqtt] переподключение…`));
  client.on('error', (e) => console.log(`${t()}  [mqtt] ошибка: ${e.message}`));
}

function forward(json) {
  try {
    JSON.parse(json);
  } catch {
    console.log(`${t()}  [skip] не JSON: ${json.slice(0, 80)}`);
    return;
  }
  if (dry) {
    console.log(`${t()}  [dry] ${json}`);
    return;
  }
  if (!client?.connected) {
    console.log(`${t()}  [wait] нет связи с MQTT, пакет пропущен`);
    return;
  }
  client.publish(TOPIC, json, { qos: 0 }, (err) => {
    if (err) console.log(`${t()}  [mqtt] не отправлено: ${err.message}`);
    else console.log(`${t()}  [sent #${++sent}] ${json}`);
  });
}

// ---- serial
function setBaud() {
  const flag = process.platform === 'darwin' ? '-f' : '-F';
  execFile('stty', [flag, port, BAUD, 'raw', '-echo'], (err) => {
    if (err) console.log(`${t()}  [usb] stty не сработал (${err.message.trim()}), читаю как есть`);
  });
}

// Если плата замолчала (отошёл кабель, зависла, порт забрал другой процесс),
// поток часто не закрывается сам — переоткрываем порт после 60 с тишины.
let lastData = Date.now();
let current = null;
setInterval(() => {
  if (!current || Date.now() - lastData < 60_000) return;
  console.log(`${t()}  [usb] плата молчит ${Math.round((Date.now() - lastData) / 1000)} с — переподключаю порт`);
  const s = current;
  current = null;
  s.removeAllListeners();
  s.destroy();
  lastData = Date.now();
  setTimeout(open, 1000);
}, 15_000);

function open() {
  if (!existsSync(port)) {
    console.log(`${t()}  [usb] порт ${port} не найден — плата подключена? Повтор через 5 с`);
    setTimeout(open, 5000);
    return;
  }
  let buf = '';
  const s = createReadStream(port, { encoding: 'utf8', highWaterMark: 256 });
  current = s;
  lastData = Date.now();
  s.on('open', () => {
    setBaud();
    console.log(`${t()}  [usb] читаю ${port} (${BAUD} бод)`);
  });
  s.on('data', (chunk) => {
    lastData = Date.now();
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, '');
      buf = buf.slice(i + 1);
      const m = PACKET.exec(line);
      if (m) forward(m[1]);
      else if (line.trim()) console.log(`${t()}  [board] ${line}`);
    }
    if (buf.length > 4096) buf = buf.slice(-1024);
  });
  const reopen = (why) => {
    if (current !== s) return;
    current = null;
    console.log(`${t()}  [usb] соединение закрыто (${why}), повтор через 5 с`);
    setTimeout(open, 5000);
  };
  s.on('error', (e) => reopen(e.message));
  s.on('end', () => reopen('end'));
}

// ---- keep Render awake
async function ping() {
  try {
    const r = await fetch(`${API}/api/stations`, { signal: AbortSignal.timeout(60000) });
    const d = await r.json();
    const st = d.stations?.find((x) => x.id === 'aua-mq135-auezov-1');
    const state = st ? (st.online ? `онлайн, ${st.minutes_ago} мин назад` : 'офлайн') : 'нет в списке';
    console.log(`${t()}  [api] ${API} отвечает · станция: ${state}`);
  } catch (e) {
    console.log(`${t()}  [api] ${API} не ответил: ${e.message}`);
  }
}
if (!dry) {
  ping();
  setInterval(ping, 10 * 60 * 1000);
}

console.log(`AUA USB-мост${dry ? ' (dry-run)' : ''}. Остановить: Ctrl+C`);
open();

process.on('SIGINT', () => {
  console.log(`\nОстановлено. Отправлено пакетов: ${sent}`);
  client?.end(true);
  process.exit(0);
});
