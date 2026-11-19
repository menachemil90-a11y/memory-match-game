#!/usr/bin/env node
/**
 * Generates the app icon, Android adaptive icon layers, splash image, favicon
 * and Play Store graphics from one vector logo (our own artwork).
 * Run: npm run brand
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Resvg } from '@resvg/resvg-js';

import { encodeRgbPng } from './lib/png.mjs';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONT = join(
  dirname(require.resolve('@expo-google-fonts/fredoka/package.json')),
  '700Bold/Fredoka_700Bold.ttf',
);

const GRAPE = '#5B3FD9';
const GRAPE_LIGHT = '#8B73FF';
const SKY_LIGHT = '#3FB8F5';
const CORAL = '#F2476F';
const SKY = '#178ED3';
const SUN = '#FFC83D';
const CREAM = '#FFF8EC';

function png(svg, width, fonts = true) {
  return new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: fonts
      ? { fontFiles: [FONT], loadSystemFonts: false, defaultFontFamily: 'Fredoka' }
      : undefined,
  })
    .render()
    .asPng();
}

function save(rel, data) {
  const file = join(ROOT, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  console.log('wrote', rel);
}

/** Two tilted cards with question marks + a sparkle, centered at (cx, cy). */
function logo(cx, cy, size, { mono = false } = {}) {
  const w = size * 0.5;
  const h = size * 0.64;
  const stroke = size * 0.045;
  const card = (dx, dy, rot, fill) => `
    <g transform="translate(${cx + dx} ${cy + dy}) rotate(${rot})">
      ${mono ? '' : `<rect x="${-w / 2 + size * 0.02}" y="${-h / 2 + size * 0.04}" width="${w}" height="${h}" rx="${w * 0.2}" fill="#000" fill-opacity="0.18"/>`}
      <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${w * 0.2}"
        fill="${mono ? '#fff' : fill}" stroke="${mono ? 'none' : CREAM}" stroke-width="${stroke}"/>
      <text x="0" y="${h * 0.19}" font-family="Fredoka" font-weight="700" font-size="${h * 0.56}"
        fill="${mono ? '#000' : '#fff'}" text-anchor="middle">?</text>
    </g>`;
  const sparkle = (x, y, r) =>
    `<path d="M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r} Z" fill="${mono ? '#fff' : SUN}"/>`;
  return `
    ${card(-size * 0.17, size * 0.03, -13, CORAL)}
    ${card(size * 0.17, -size * 0.01, 11, SKY)}
    ${sparkle(cx + size * 0.38, cy - size * 0.36, size * 0.09)}
    ${sparkle(cx - size * 0.4, cy + size * 0.33, size * 0.055)}`;
}

const gradient = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0" stop-color="${GRAPE_LIGHT}"/>
      <stop offset="0.55" stop-color="${GRAPE}"/>
      <stop offset="1" stop-color="${SKY_LIGHT}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.42" r="0.5">
      <stop offset="0" stop-color="#fff" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>`;

const S = 1024;
const svg = (body, w = S, h = S) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${gradient}${body}</svg>`;

// iOS / store icon: full-bleed, no transparency.
const icon = svg(
  `<rect width="${S}" height="${S}" fill="url(#bg)"/><circle cx="512" cy="440" r="460" fill="url(#glow)"/>${logo(512, 520, 640)}`,
);
save('assets/icon.png', png(icon, 1024));
save('docs/store/play-icon-512.png', png(icon, 512));

// Android adaptive icon: logo within the 66% safe zone; background separate.
save('assets/android-icon-foreground.png', png(svg(logo(512, 520, 470)), 1024));
save(
  'assets/android-icon-background.png',
  png(
    svg(
      `<rect width="${S}" height="${S}" fill="url(#bg)"/><circle cx="512" cy="440" r="460" fill="url(#glow)"/>`,
    ),
    1024,
  ),
);
save('assets/android-icon-monochrome.png', png(svg(logo(512, 520, 470, { mono: true })), 1024));

// Splash: logo only (background color comes from app.json).
save('assets/splash-icon.png', png(svg(logo(512, 512, 760)), 1024));
save('assets/favicon.png', png(icon, 48));

// Play Store feature graphic (1024×500).
const feature = svg(
  `<rect width="1024" height="500" fill="url(#bg)"/>
   <circle cx="250" cy="250" r="300" fill="url(#glow)"/>
   ${logo(250, 260, 330)}
   <text x="470" y="235" font-family="Fredoka" font-weight="700" font-size="92" fill="#fff">Memory</text>
   <text x="470" y="335" font-family="Fredoka" font-weight="700" font-size="92" fill="${SUN}">Match</text>
   <text x="474" y="400" font-family="Fredoka" font-weight="700" font-size="34" fill="#fff" fill-opacity="0.85">Your photos. Your game.</text>`,
  1024,
  500,
);
save(
  'docs/store/feature-graphic.png',
  encodeRgbPng(
    new Resvg(feature, {
      fitTo: { mode: 'width', value: 1024 },
      background: GRAPE, // Play requires a feature graphic without alpha
      font: { fontFiles: [FONT], loadSystemFonts: false, defaultFontFamily: 'Fredoka' },
    }).render(),
  ),
);

// Web game: link previews for chat apps (Open Graph, 1200×630). WhatsApp shows them
// wide or as a centered square thumbnail, so everything that matters sits in the
// middle 630×630: real game cards (a found pair glowing), the name and a "Play"
// button. No alpha: some chat apps show transparency as black.
const cardArt = (rel) =>
  `data:image/png;base64,${readFileSync(join(ROOT, rel)).toString('base64')}`;
const FOX = cardArt('assets/boards/animals/fox.png');
const CAT = cardArt('assets/boards/animals/cat.png');
const PANDA = cardArt('assets/boards/animals/panda.png');
const BACK = cardArt('assets/card-backs/grape-stars.png');

/** A game card at (cx, cy), rotated: face-up art on its color, or the card back. */
function card(cx, cy, w, rot, { art, bg, glow = false, opacity = 1 } = {}) {
  const h = w * 1.18;
  const r = w * 0.16;
  const inner = art
    ? `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${r}" fill="${bg}"/>
       <image href="${art}" x="${-w * 0.36}" y="${-w * 0.36}" width="${w * 0.72}" height="${w * 0.72}"/>`
    : `<image href="${BACK}" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"
         clip-path="inset(0 round ${r}px)"/>`;
  return `<g transform="translate(${cx} ${cy}) rotate(${rot})" opacity="${opacity}">
    <rect x="${-w / 2 + 6}" y="${-h / 2 + 10}" width="${w}" height="${h}" rx="${r}" fill="#000" fill-opacity="0.22"/>
    <clipPath id="c${Math.round(cx)}${Math.round(cy)}"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${r}"/></clipPath>
    <g clip-path="url(#c${Math.round(cx)}${Math.round(cy)})">${inner}</g>
    <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${r}" fill="none" stroke="${glow ? SUN : CREAM}" stroke-width="${w * (glow ? 0.07 : 0.05)}"/>
  </g>`;
}

/** The link preview: cards on top, the name, a call to action in a "button". */
function linkPreview({ kicker, title, button }) {
  const buttonW = 70 + button.length * 21;
  return svg(
    `<rect width="1200" height="630" fill="url(#bg)"/>
     <circle cx="600" cy="230" r="420" fill="url(#glow)"/>
     ${card(150, 140, 150, -16)}
     ${card(1060, 120, 140, 14)}
     ${card(110, 500, 140, 10, { art: CAT, bg: '#FFF0C9', opacity: 0.9 })}
     ${card(1090, 500, 150, -12, { art: PANDA, bg: '#FFF0C9', opacity: 0.9 })}
     ${card(470, 190, 150, -12)}
     ${card(600, 170, 165, 0, { art: FOX, bg: '#E6F9E9', glow: true })}
     ${card(730, 190, 150, 12, { art: FOX, bg: '#E6F9E9', glow: true })}
     ${sparkle(812, 95, 26)}${sparkle(392, 300, 16)}
     <text x="600" y="${kicker ? 362 : 390}" text-anchor="middle" font-family="Fredoka" font-weight="700" font-size="${kicker ? 30 : 0}" fill="#fff" fill-opacity="0.92">${kicker ?? ''}</text>
     <text x="600" y="${kicker ? 440 : 432}" text-anchor="middle" font-family="Fredoka" font-weight="700" font-size="84" fill="#fff" stroke="#3E24A8" stroke-width="3" paint-order="stroke">${title}</text>
     <rect x="${600 - buttonW / 2}" y="482" width="${buttonW}" height="86" rx="43" fill="#E09A00"/>
     <rect x="${600 - buttonW / 2}" y="474" width="${buttonW}" height="86" rx="43" fill="${SUN}"/>
     <path d="M${600 - buttonW / 2 + 44} 499 l28 18 l-28 18 z" fill="#5C3B00"/>
     <text x="${600 - buttonW / 2 + 86}" y="530" font-family="Fredoka" font-weight="700" font-size="38" fill="#5C3B00">${button}</text>`,
    1200,
    630,
  );
}

const sparkle = (x, y, r) =>
  `<path d="M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r} Z" fill="${SUN}"/>`;

const savePreview = (rel, svgText) =>
  save(
    rel,
    encodeRgbPng(
      new Resvg(svgText, {
        fitTo: { mode: 'width', value: 1200 },
        background: GRAPE,
        font: { fontFiles: [FONT], loadSystemFonts: false, defaultFontFamily: 'Fredoka' },
      }).render(),
    ),
  );
savePreview(
  'public/og-image.png',
  linkPreview({ title: 'Memory Match', button: 'Play free, no download' }),
);
savePreview(
  'public/og-invite.png',
  linkPreview({
    kicker: "You're invited to a game!",
    title: 'Memory Match',
    button: 'Tap to play with me',
  }),
);
save('public/apple-touch-icon.png', png(icon, 180));
