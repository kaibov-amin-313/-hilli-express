// Reads the MQ-135 station over USB instead of MQTT.
//
// For places without internet (the defense hall): the ESP8266 is plugged into
// the laptop, the firmware prints every packet as `[pub] {...}` on its serial
// line, and this reader feeds those packets into exactly the same path the
// MQTT subscriber uses. The readings are real and live; only the transport
// changes. Plain fs + stty, so no native serial module is needed.

import { createReadStream, existsSync, type ReadStream } from 'node:fs';
import { execFile } from 'node:child_process';
import { config } from '../config.js';
import { acceptMq135Payload } from './mq135Mqtt.js';

interface Logger {
  info: (o: unknown, m?: string) => void;
  warn: (o: unknown, m?: string) => void;
  error: (o: unknown, m?: string) => void;
}

const PACKET = /^\[pub\]\s+(\{.*\})\s*$/;
let stream: ReadStream | null = null;
let retry: NodeJS.Timeout | null = null;
let stopped = false;

function setBaud(port: string, baud: number, log?: Logger): void {
  // macOS stty takes -f, Linux takes -F. Settings only stick while the port is
  // open, so this runs after the read stream has opened it.
  const flag = process.platform === 'darwin' ? '-f' : '-F';
  execFile('stty', [flag, port, String(baud), 'raw', '-echo'], (err) => {
    if (err) log?.warn({ err: err.message, port }, 'stty failed; reading with the port defaults');
  });
}

function open(log?: Logger): void {
  const port = config.mq135SerialPort;
  if (stopped) return;
  if (!existsSync(port)) {
    log?.warn({ port }, 'MQ-135 serial port not found, retrying in 5 s (is the board plugged in?)');
    retry = setTimeout(() => open(log), 5_000);
    return;
  }

  let buf = '';
  stream = createReadStream(port, { encoding: 'utf8', highWaterMark: 256 });
  stream.on('open', () => {
    setBaud(port, config.mq135SerialBaud, log);
    log?.info({ port }, 'MQ-135 USB serial reader started');
  });
  stream.on('data', (chunk) => {
    buf += chunk;
    let i: number;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, '');
      buf = buf.slice(i + 1);
      const m = PACKET.exec(line);
      if (m?.[1]) acceptMq135Payload(`usb:${port}`, Buffer.from(m[1], "utf8"), log);
    }
    if (buf.length > 4096) buf = buf.slice(-1024);
  });
  const reopen = (why: string) => {
    if (stopped) return;
    log?.warn({ port, why }, 'MQ-135 serial line closed, reopening in 5 s');
    stream = null;
    retry = setTimeout(() => open(log), 5_000);
  };
  stream.on('error', (err) => reopen(err.message));
  stream.on('end', () => reopen('end'));
}

export function startMq135SerialReader(log?: Logger): void {
  if (!config.mq135SerialPort || stream) return;
  stopped = false;
  open(log);
}

export function stopMq135SerialReader(): void {
  stopped = true;
  if (retry) clearTimeout(retry);
  stream?.destroy();
  stream = null;
}
