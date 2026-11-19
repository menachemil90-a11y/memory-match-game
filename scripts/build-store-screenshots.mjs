#!/usr/bin/env node
/**
 * Turns raw app screenshots (1080×1920) into captioned Google Play phone
 * screenshots (1080×1920, 9:16) in the app's own style: brand gradient,
 * Fredoka caption, rounded "screen" with a soft shadow.
 *
 * 1. Raw shots: screenshots of the Android app (phone or emulator, 1080×1920)
 *    saved in docs/store/screenshots/raw/ under the names in SHOTS. (The first
 *    set came from the web build, which since 0.3.0 is the online-only web
 *    game, so new shots come from the app.)
 * 2. Frame them:  npm run store:screenshots
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Resvg } from '@resvg/resvg-js';

import { encodeRgbPng } from './lib/png.mjs';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'docs/store/screenshots/raw');
const OUT = join(ROOT, 'docs/store/screenshots');
const FONT = join(
  dirname(require.resolve('@expo-google-fonts/fredoka/package.json')),
  '700Bold/Fredoka_700Bold.ttf',
);

// Brand colors (same values as colors.backgroundGradient / palette in src/ui/theme/tokens.ts).
const GRADIENT = ['#7B5CFF', '#5B3FD9', '#2A82CC'];
const CREAM = '#FFF8EC';

/** Store order: the first two or three screenshots matter most. */
const SHOTS = [
  { raw: '04-game', caption: ['Flip, remember,', 'find the pairs!'] },
  { raw: '02-boards', caption: ['8 picture boards —', 'or make your own'] },
  { raw: '07-two-players', caption: ['Play together', 'on one phone'] },
  { raw: '03-levels', caption: ['6 levels, from', 'little kids to experts'] },
  { raw: '05-results', caption: ['Earn stars and', 'beat your best'] },
  { raw: '01-home', caption: ['Solo, 2 players or', 'online with family'] },
];

const W = 1080;
const H = 1920;
const SHOT_W = 800;
const SHOT_H = Math.round((SHOT_W * 1920) / 1080); // 1422
const SHOT_X = (W - SHOT_W) / 2;
const SHOT_Y = 400;
const RADIUS = 56;
const BORDER = 10;

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function frame(rawPng, caption) {
  const image = `data:image/png;base64,${rawPng.toString('base64')}`;
  const lines = caption
    .map(
      (line, i) =>
        `<text x="${W / 2}" y="${175 + i * 104}" font-family="Fredoka" font-weight="700"
           font-size="88" fill="#fff" text-anchor="middle">${escape(line)}</text>`,
    )
    .join('\n');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
      width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${GRADIENT[0]}"/>
        <stop offset="0.55" stop-color="${GRADIENT[1]}"/>
        <stop offset="1" stop-color="${GRADIENT[2]}"/>
      </linearGradient>
      <clipPath id="screen">
        <rect x="${SHOT_X}" y="${SHOT_Y}" width="${SHOT_W}" height="${SHOT_H}" rx="${RADIUS}"/>
      </clipPath>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="28"/>
      </filter>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    ${lines}
    <rect x="${SHOT_X - BORDER}" y="${SHOT_Y - BORDER + 24}" width="${SHOT_W + 2 * BORDER}"
      height="${SHOT_H + 2 * BORDER}" rx="${RADIUS + BORDER}" fill="#1B1040" fill-opacity="0.45"
      filter="url(#shadow)"/>
    <rect x="${SHOT_X - BORDER}" y="${SHOT_Y - BORDER}" width="${SHOT_W + 2 * BORDER}"
      height="${SHOT_H + 2 * BORDER}" rx="${RADIUS + BORDER}" fill="${CREAM}"/>
    <image x="${SHOT_X}" y="${SHOT_Y}" width="${SHOT_W}" height="${SHOT_H}"
      xlink:href="${image}" clip-path="url(#screen)" preserveAspectRatio="xMidYMid slice"/>
  </svg>`;
  return encodeRgbPng(
    new Resvg(svg, {
      fitTo: { mode: 'width', value: W },
      background: GRADIENT[1], // opaque: Play wants 24-bit PNGs without alpha
      font: { fontFiles: [FONT], loadSystemFonts: false, defaultFontFamily: 'Fredoka' },
    }).render(),
  );
}

mkdirSync(OUT, { recursive: true });
let n = 0;
for (const { raw, caption } of SHOTS) {
  const file = join(RAW, `${raw}.png`);
  if (!existsSync(file)) {
    console.error(`missing ${file} — capture the raw screenshots first`);
    process.exit(1);
  }
  n += 1;
  const out = join(OUT, `phone-${n}.png`);
  writeFileSync(out, frame(readFileSync(file), caption));
  console.log('wrote', out.slice(ROOT.length + 1));
}
