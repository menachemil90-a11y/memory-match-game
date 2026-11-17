#!/usr/bin/env node
/**
 * Builds bundled art from vector sources:
 *  - built-in board images: Twemoji SVG → PNG (transparent)
 *  - card backs: generated SVG designs → PNG
 *  - src/features/boards/builtin/generated.ts with static require()s for Metro
 *
 * Run: npm run assets
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Resvg } from '@resvg/resvg-js';

import { AVATARS, BOARDS, CARD_BACKS, FACE_PALETTES } from './boards.mjs';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TWEMOJI_DIR = dirname(require.resolve('@twemoji/svg/package.json'));
const FONT_BOLD = join(
  dirname(require.resolve('@expo-google-fonts/fredoka/package.json')),
  '700Bold/Fredoka_700Bold.ttf',
);
const OUT_TS = join(ROOT, 'src/features/boards/builtin/generated.ts');
const EMOJI_PX = 320;
const BACK_PX = 400;

function render(svg, width, { fonts = false } = {}) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: fonts
      ? { fontFiles: [FONT_BOLD], loadSystemFonts: false, defaultFontFamily: 'Fredoka' }
      : { loadSystemFonts: false },
  });
  return resvg.render().asPng();
}

function write(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
}

/** Twemoji file name for an emoji: code points in hex, joined by '-', without FE0F. */
function twemojiFile(emoji) {
  const points = [...emoji].map((c) => c.codePointAt(0).toString(16));
  const withoutVs = points.filter((p) => p !== 'fe0f').join('-');
  for (const name of [withoutVs, points.join('-')]) {
    const file = join(TWEMOJI_DIR, `${name}.svg`);
    if (existsSync(file)) return file;
  }
  throw new Error(`No Twemoji SVG for ${emoji} (${withoutVs})`);
}

// ---------- card backs ----------

function star(cx, cy, r, points = 5, inner = 0.45) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : r * inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}"/>`;
}

/** Deterministic pseudo-random numbers for decorative layouts (not game logic). */
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function pattern(kind, size) {
  const out = [];
  const step = size / 6;
  switch (kind) {
    case 'stars':
      for (let y = 0; y <= 6; y++)
        for (let x = 0; x <= 6; x++)
          out.push(star(x * step + (y % 2 ? step / 2 : 0), y * step, step * 0.22));
      break;
    case 'dots':
      for (let y = 0; y <= 8; y++)
        for (let x = 0; x <= 8; x++)
          out.push(
            `<circle cx="${x * (size / 8) + (y % 2 ? size / 16 : 0)}" cy="${y * (size / 8)}" r="${size / 40}"/>`,
          );
      break;
    case 'stripes':
      for (let i = -size; i < size * 2; i += size / 7)
        out.push(
          `<rect x="${i}" y="${-size}" width="${size / 18}" height="${size * 3}" transform="rotate(35 ${size / 2} ${size / 2})"/>`,
        );
      break;
    case 'bubbles': {
      const rnd = seeded(7);
      for (let i = 0; i < 26; i++) {
        const r = size * (0.02 + rnd() * 0.06);
        out.push(
          `<circle cx="${(rnd() * size).toFixed(1)}" cy="${(rnd() * size).toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="#fff" stroke-width="${(r * 0.28).toFixed(1)}"/>`,
        );
      }
      break;
    }
    case 'sparkles': {
      const rnd = seeded(42);
      for (let i = 0; i < 18; i++)
        out.push(star(rnd() * size, rnd() * size, size * (0.025 + rnd() * 0.035), 4, 0.25));
      for (let i = 0; i < 40; i++)
        out.push(
          `<circle cx="${(rnd() * size).toFixed(1)}" cy="${(rnd() * size).toFixed(1)}" r="${(size * 0.006 + rnd() * 2).toFixed(1)}"/>`,
        );
      break;
    }
    case 'leaves':
      for (let y = 0; y <= 6; y++)
        for (let x = 0; x <= 6; x++) {
          const cx = x * step + (y % 2 ? step / 2 : 0);
          const cy = y * step;
          out.push(
            `<ellipse cx="${cx}" cy="${cy}" rx="${step * 0.14}" ry="${step * 0.3}" transform="rotate(${(x + y) % 2 ? 35 : -35} ${cx} ${cy})"/>`,
          );
        }
      break;
    case 'checks':
      for (let y = 0; y < 10; y++)
        for (let x = 0; x < 10; x++)
          if ((x + y) % 2 === 0)
            out.push(
              `<rect x="${x * (size / 10)}" y="${y * (size / 10)}" width="${size / 10}" height="${size / 10}"/>`,
            );
      break;
    case 'zigzag':
      for (let y = -1; y <= 8; y++) {
        const pts = [];
        for (let x = 0; x <= 12; x++)
          pts.push(`${x * (size / 12)},${y * (size / 8) + (x % 2 ? size / 24 : -size / 24)}`);
        out.push(
          `<polyline points="${pts.join(' ')}" fill="none" stroke="#fff" stroke-width="${size / 60}" stroke-linejoin="round"/>`,
        );
      }
      break;
    default:
      throw new Error(`Unknown pattern ${kind}`);
  }
  return out.join('');
}

/** The game logo: two tilted cards with question marks on a white badge. */
function logo(cx, cy, size, accent) {
  const w = size * 0.42;
  const h = size * 0.54;
  const card = (dx, rot, fill) => `
    <g transform="translate(${cx + dx} ${cy}) rotate(${rot})">
      <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${w * 0.2}" fill="${fill}" stroke="#fff" stroke-width="${size * 0.035}"/>
      <text x="0" y="${h * 0.17}" font-family="Fredoka" font-weight="700" font-size="${h * 0.5}" fill="#fff" text-anchor="middle">?</text>
    </g>`;
  return `
    <circle cx="${cx}" cy="${cy}" r="${size * 0.52}" fill="#fff" fill-opacity="0.95"/>
    <circle cx="${cx}" cy="${cy}" r="${size * 0.52}" fill="none" stroke="${accent}" stroke-opacity="0.25" stroke-width="${size * 0.03}"/>
    ${card(-size * 0.13, -12, '#F2476F')}
    ${card(size * 0.13, 10, '#178ED3')}`;
}

function cardBackSvg({ from, to, pattern: kind }) {
  const s = BACK_PX;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
    </linearGradient>
    <radialGradient id="shine" cx="0.3" cy="0.2" r="0.8">
      <stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="0.6" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${s}" height="${s}" fill="url(#g)"/>
  <g fill="#fff" fill-opacity="0.16" stroke-opacity="0.16">${pattern(kind, s)}</g>
  <rect width="${s}" height="${s}" fill="url(#shine)"/>
  <rect x="${s * 0.06}" y="${s * 0.06}" width="${s * 0.88}" height="${s * 0.88}" rx="${s * 0.09}" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="${s * 0.018}" stroke-dasharray="${s * 0.04} ${s * 0.025}"/>
  ${logo(s / 2, s / 2, s * 0.44, to)}
</svg>`;
}

// ---------- run ----------

const rel = (file) => relative(dirname(OUT_TS), file).split('\\').join('/');
const lines = [];
let emojiCount = 0;

lines.push(
  '// AUTO-GENERATED by scripts/build-assets.mjs — do not edit by hand.',
  "import type { BuiltinBoardData, CardBackId } from './types';",
  '',
  'export const CARD_BACK_IDS = [',
  ...CARD_BACKS.map((b) => `  '${b.id}',`),
  '] as const;',
  '',
  'export const CARD_BACK_SOURCES: Record<CardBackId, number> = {',
);
for (const back of CARD_BACKS) {
  const file = join(ROOT, 'assets/card-backs', `${back.id}.png`);
  write(file, render(cardBackSvg(back), BACK_PX, { fonts: true }));
  lines.push(`  '${back.id}': require('${rel(file)}'),`);
}
lines.push('};', '', 'export const BUILTIN_BOARD_DATA: readonly BuiltinBoardData[] = [');

for (const board of BOARDS) {
  const palette = FACE_PALETTES[board.palette];
  const keys = new Set();
  if (board.items.length < 18) throw new Error(`${board.id} needs at least 18 images`);
  lines.push(
    `  {`,
    `    id: '${board.id}',`,
    `    cardBack: '${board.cardBack}',`,
    `    accent: '${board.accent}',`,
    `    images: [`,
  );
  board.items.forEach(([key, emoji, label], i) => {
    if (keys.has(key)) throw new Error(`Duplicate key ${board.id}/${key}`);
    keys.add(key);
    const out = join(ROOT, 'assets/boards', board.id, `${key}.png`);
    if (board.art !== 'custom') {
      write(out, render(readFileSync(twemojiFile(emoji), 'utf8'), EMOJI_PX));
      emojiCount++;
    } else if (!existsSync(out)) {
      throw new Error(`Missing custom art ${out}`);
    }
    lines.push(
      `      { key: '${key}', label: ${JSON.stringify(label)}, background: '${palette[i % palette.length]}', source: require('${rel(out)}') },`,
    );
  });
  lines.push('    ],', '  },');
}
lines.push('];', '', 'export const AVATAR_SOURCES = {');
for (const [id, emoji] of AVATARS) {
  const out = join(ROOT, 'assets/avatars', `${id}.png`);
  write(out, render(readFileSync(twemojiFile(emoji), 'utf8'), 160));
  lines.push(`  '${id}': require('${rel(out)}'),`);
}
lines.push('} as const satisfies Record<string, number>;', '');

write(OUT_TS, lines.join('\n'));
console.log(
  `Rendered ${emojiCount} board images and ${CARD_BACKS.length} card backs → ${relative(ROOT, OUT_TS)}`,
);
