/**
 * Renders the promo videos from content.json + the recorded footage.
 *
 *   node render/render.mjs [--format 9x16|4x5|all] [--lang he,en] [--strict] [video-id ...]
 *
 * Output: out/renders/<video>.<lang>.<format>.mp4 and <…>.contact.png (6 frames).
 * Each frame is drawn by render/stage.html (Playwright, at the output size) and piped
 * to ffmpeg; the audio is the game's own sound effects, placed on the footage's
 * markers (flip/match/miss/deal) and the scenes' "sfx" entries.
 */
import { Buffer } from 'node:buffer';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const PROMO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = resolve(PROMO, '..');
const FOOTAGE = join(PROMO, 'out/footage');
const RENDERS = join(PROMO, 'out/renders');
const content = JSON.parse(readFileSync(join(PROMO, 'content.json'), 'utf8'));
const FPS = content.fps;
const SIZES = { '9x16': [1080, 1920], '4x5': [1080, 1350] };
const RATE = 48_000;

// The game's own volumes (src/lib/sound.ts VOLUME).
const VOLUME = { flip: 0.8, deal: 0.5, match: 0.9, miss: 0.7, win: 1, turn: 0.7 };
const WEB_URL = 'https://memorymatch-online.pages.dev';
// The real invite message (src/lib/i18n/locales/en.ts online.inviteMessage).
const INVITE =
  "Let's play Memory Match! 🃏 Tap to play with me right in your browser — no download needed: {{link}} (Room code: {{code}})";

// ---------------------------------------------------------------------------
// Arguments
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const value = args[i + 1];
  args.splice(i, 2);
  return value;
};
const formatArg = opt('format', '9x16');
const formats = formatArg === 'all' ? ['9x16', '4x5'] : formatArg.split(',');
const langs = opt('lang', 'he,en').split(',');
const strict = args.includes('--strict');
const ids = args.filter((a) => !a.startsWith('--'));
const videos = content.videos.filter((v) => !ids.length || ids.includes(v.id));

// ---------------------------------------------------------------------------
// A static server for the stage, its fonts and the footage (fonts need http).
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
};
const server = createServer((req, res) => {
  const path = resolve(ROOT, `.${decodeURIComponent(new URL(req.url, 'http://x').pathname)}`);
  if (!path.startsWith(ROOT) || !existsSync(path)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {
    'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream',
    'Cache-Control': 'max-age=3600',
  });
  res.end(readFileSync(path));
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${server.address().port}`;
const url = (abs) => `${BASE}/${relative(ROOT, abs).split('\\').join('/')}`;

// ---------------------------------------------------------------------------
// Footage
const clipCache = new Map();
function loadClip(name) {
  if (!clipCache.has(name)) {
    const file = join(FOOTAGE, name, 'clip.json');
    if (!existsSync(file)) return null;
    const clip = JSON.parse(readFileSync(file, 'utf8'));
    clip.name = name;
    clip.frames = clip.frames.map((f) => ({ t: f.t, url: url(join(FOOTAGE, name, f.file)) }));
    clipCache.set(name, clip);
  }
  return clipCache.get(name);
}
/** A clip by its base name: the language's own recording when there is one. */
function clipFor(base, lang) {
  const clip = loadClip(`${base}.${lang}`) ?? loadClip(base);
  if (!clip) throw new Missing(`footage "${base}" (${lang})`);
  return clip;
}
class Missing extends Error {}

/** Absolute time (clip clock) of a "from" reference. */
function at(clip, from) {
  const offset = from.offset ?? 0;
  if (from.start) return clip.frames[0].t + offset;
  if (from.end) return clip.frames.at(-1).t + offset;
  if (from.goAgain) {
    // The first pair the child finds that's followed right away by another of theirs:
    // start on that pair's first flip.
    const turns = clip.markers.filter((m) => /^(match|miss)/.test(m.name));
    const i = turns.findIndex(
      (m, k) => m.name === 'match:child' && turns[k + 1]?.name === 'match:child',
    );
    if (i < 0) throw new Error(`${clip.name}: no "go again" moment`);
    const flips = clip.markers.filter((m) => m.name === 'flip' && m.t < turns[i].t);
    return flips.at(-2).t + offset;
  }
  const hits = clip.markers.filter((m) => m.name === from.marker);
  const hit = hits[from.nth ?? 0];
  if (!hit) throw new Error(`${clip.name}: no marker "${from.marker}" #${from.nth ?? 0}`);
  return hit.t + offset;
}

// ---------------------------------------------------------------------------
// Timeline
/** Resolves a video's scenes for one language: start/dur, footage times, sounds. */
function timeline(video, lang) {
  const scenes = [];
  const clips = {};
  const sounds = [];
  let start = 0;
  const keep = (clip) => {
    clips[clip.name] = { frames: clip.frames };
    return clip.name;
  };
  /** The game's sounds for the footage shown in [abs0, abs0 + dur) at scene time `start`. */
  const footageSounds = (clip, abs0, dur, sceneStart) => {
    for (const m of clip.markers) {
      const t = m.t - abs0;
      if (t < 0 || t >= dur) continue;
      const when = sceneStart + t;
      if (m.name === 'flip') sounds.push({ at: when, sound: 'flip' });
      else if (m.name.startsWith('match')) sounds.push({ at: when + 0.3, sound: 'match' });
      else if (m.name === 'miss') sounds.push({ at: when + 0.45, sound: 'miss' });
      else if (m.name === 'deal' || m.name === 'dealt')
        sounds.push({ at: when + 0.05, sound: 'deal' });
    }
  };
  let room = null;

  for (const raw of video.scenes) {
    const sc = { ...raw, start };
    switch (raw.type) {
      case 'phone': {
        const clip = clipFor(raw.clip, lang);
        sc.clip = keep(clip);
        sc.abs0 = at(clip, raw.from);
        footageSounds(clip, sc.abs0, Math.min(raw.dur, raw.freezeAfter ?? Infinity), start);
        break;
      }
      case 'two-phones': {
        const left = clipFor(raw.left, lang);
        const right = clipFor(raw.right, lang);
        sc.left = keep(left);
        sc.right = keep(right);
        sc.abs0 = at(raw.from.clip === 'right' ? right : left, raw.from);
        footageSounds(left, sc.abs0, raw.dur, start);
        footageSounds(right, sc.abs0, raw.dur, start);
        room ??= left.meta?.code;
        break;
      }
      case 'montage': {
        sc.clips = raw.clips.map((part) => {
          const clip = clipFor(part.clip, lang);
          return { ...part, clip: keep(clip), abs0: at(clip, part.from) };
        });
        let partStart = start;
        for (const [k, part] of sc.clips.entries()) {
          footageSounds(loadClip(part.clip), part.abs0, part.dur, partStart);
          partStart += part.dur;
          if (k === sc.clips.length - 1) break;
        }
        break;
      }
      case 'speedrun': {
        const clip = clipFor(raw.clip, lang);
        sc.clip = keep(clip);
        sc.abs0 = at(clip, raw.from);
        sc.runStart = at(clip, { marker: 'run:start' }) - sc.abs0;
        sc.runEnd = at(clip, { marker: 'run:end' }) - sc.abs0;
        const until = at(clip, raw.until) - sc.abs0;
        sc.dur = Math.max(until, sc.runEnd + 0.15) + raw.after.dur;
        footageSounds(clip, sc.abs0, sc.runEnd + 0.5, start);
        sounds.push({ at: start + sc.runEnd + 0.6, sound: 'win' });
        break;
      }
      case 'hook-flip':
        sounds.push({ at: start + 0.35, sound: 'flip' }, { at: start + 0.95, sound: 'match' });
        break;
      case 'gallery':
        sounds.push({ at: start + 1.5, sound: 'deal' });
        break;
      case 'chat':
        sounds.push({ at: start + 0.2, sound: 'turn' });
        break;
      case 'endcard':
        sc.dur = content.endcard.dur;
        sounds.push({ at: start + 0.05, sound: 'deal' });
        break;
      default:
        throw new Error(`unknown scene type ${raw.type}`);
    }
    for (const s of raw.sfx ?? []) sounds.push({ at: start + s.at, sound: s.sound });
    scenes.push(sc);
    start += sc.dur;
  }

  // The chat scene shows the real invite message of the game that follows.
  const code = room ?? 'K7QM2P';
  const link = `${WEB_URL}/join/?c=${code}`;
  const [before, after] = INVITE.replace('{{code}}', code).split('{{link}}');
  return { scenes, clips, sounds, duration: start, inviteText: { before, link, after } };
}

// ---------------------------------------------------------------------------
// Assets
const twemoji = {};
function collectEmoji(text) {
  for (const ch of Array.from(text ?? '')) {
    const cp = ch.codePointAt(0);
    if (cp < 0x2300 || cp === 0xfe0f || cp === 0xfe0e) continue;
    const hex = cp.toString(16);
    const file = join(ROOT, 'node_modules/@twemoji/svg', `${hex}.svg`);
    if (existsSync(file)) twemoji[hex] = url(file);
  }
}
collectEmoji(JSON.stringify(content) + INVITE + '🔒⏱');
const photoNames = [
  '01-family',
  '02-grandma-baking',
  '03-grandpa-icecream',
  '04-kids-beach',
  '05-birthday',
  '06-boy-dog',
  '07-parents-selfie',
  '08-family-dinner',
];
const assets = {
  twemoji,
  cardBack: url(join(ROOT, 'assets/card-backs/grape-stars.png')),
  ogInvite: url(join(ROOT, 'public/og-invite.png')),
  photos: Object.fromEntries(photoNames.map((n) => [n, url(join(PROMO, 'photos', `${n}.jpg`))])),
  photoOrder: photoNames.slice(0, 6),
};

// ---------------------------------------------------------------------------
// Audio: the game's wavs, mixed in float at 48 kHz stereo.
const wavCache = {};
function samples(name) {
  if (!wavCache[name]) {
    const out = spawnSync(
      'ffmpeg',
      [
        '-v',
        'error',
        '-i',
        join(ROOT, 'assets/sounds', `${name}.wav`),
        '-f',
        'f32le',
        '-ac',
        '2',
        '-ar',
        String(RATE),
        '-',
      ],
      { maxBuffer: 1 << 28 },
    );
    if (out.status !== 0) throw new Error(`ffmpeg decode ${name}: ${out.stderr}`);
    wavCache[name] = new Float32Array(
      out.stdout.buffer,
      out.stdout.byteOffset,
      out.stdout.length / 4,
    );
  }
  return wavCache[name];
}
function mix(sounds, duration, file) {
  const total = Math.ceil(duration * RATE) * 2;
  const buf = new Float32Array(total);
  // Many flips at once (two phones show the same tap) would just get louder: dedupe.
  const placed = [];
  for (const s of [...sounds].sort((a, b) => a.at - b.at)) {
    if (placed.some((p) => p.sound === s.sound && Math.abs(p.at - s.at) < 0.15)) continue;
    placed.push(s);
    const src = samples(s.sound);
    const gain = VOLUME[s.sound] * 0.9;
    const offset = Math.round(s.at * RATE) * 2;
    for (let i = 0; i < src.length && offset + i < total; i++) {
      if (offset + i >= 0) buf[offset + i] += src[i] * gain;
    }
  }
  for (let i = 0; i < total; i++) buf[i] = Math.tanh(buf[i]); // soft limit
  // A short fade at the very end, so the cut is clean.
  const fadeN = Math.round(0.25 * RATE) * 2;
  for (let i = 0; i < fadeN; i++) buf[total - 1 - i] *= i / fadeN;
  writeFileSync(file, Buffer.from(buf.buffer));
  return placed.length;
}

// ---------------------------------------------------------------------------
// Rendering
mkdirSync(RENDERS, { recursive: true });
const browser = await chromium.launch();
const results = [];

async function render(video, lang, format) {
  const [W, H] = SIZES[format];
  const name = `${video.id}.${lang}.${format}`;
  const tl = timeline(video, lang);
  const frames = Math.round(tl.duration * FPS);
  const spec = {
    lang,
    format,
    scenes: tl.scenes,
    clips: tl.clips,
    assets,
    webHost: new URL(WEB_URL).host,
    inviteText: tl.inviteText,
    endcard: { ...content.endcard[lang], url: content.endcard.url },
  };

  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${BASE}/promo/render/stage.html`);
  await page.evaluate((s) => window.setup(s), spec);
  const cdp = await ctx.newCDPSession(page);

  const tmp = join(RENDERS, `.${name}`);
  mkdirSync(tmp, { recursive: true });
  const video_ = join(tmp, 'video.mp4');
  const ff = spawn(
    'ffmpeg',
    [
      '-y',
      '-v',
      'error',
      '-f',
      'image2pipe',
      '-framerate',
      String(FPS),
      '-c:v',
      'mjpeg',
      '-i',
      '-',
      '-c:v',
      'libx264',
      '-profile:v',
      'high',
      '-pix_fmt',
      'yuv420p',
      '-preset',
      'slow',
      '-crf',
      '18',
      '-r',
      String(FPS),
      '-movflags',
      '+faststart',
      video_,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  );
  const ffDone = new Promise((ok, fail) =>
    ff.on('close', (c) => (c === 0 ? ok() : fail(new Error(`ffmpeg ${c}`)))),
  );
  const sheetAt = new Set([0.06, 0.24, 0.42, 0.6, 0.78, 0.94].map((p) => Math.floor(p * frames)));
  const sheet = [];
  const t0 = Date.now();
  for (let f = 0; f < frames; f++) {
    await page.evaluate((t) => window.draw(t), f / FPS);
    const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 95 });
    const jpg = Buffer.from(shot.data, 'base64');
    if (sheetAt.has(f)) {
      const file = join(tmp, `sheet-${sheet.length}.jpg`);
      writeFileSync(file, jpg);
      sheet.push(file);
    }
    if (!ff.stdin.write(jpg)) await new Promise((ok) => ff.stdin.once('drain', ok));
  }
  ff.stdin.end();
  await ffDone;
  await ctx.close();
  if (errors.length) throw new Error(`${name}: page errors: ${errors.join(' | ')}`);

  // Audio + mux.
  const pcm = join(tmp, 'audio.f32');
  const placed = mix(tl.sounds, frames / FPS, pcm);
  const out = join(RENDERS, `${name}.mp4`);
  run('ffmpeg', [
    '-y',
    '-v',
    'error',
    '-i',
    video_,
    '-f',
    'f32le',
    '-ar',
    String(RATE),
    '-ac',
    '2',
    '-i',
    pcm,
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '160k',
    '-ar',
    String(RATE),
    '-shortest',
    '-movflags',
    '+faststart',
    out,
  ]);
  // Contact sheet: 6 frames side by side.
  const sheetH = 640;
  run('ffmpeg', [
    '-y',
    '-v',
    'error',
    ...sheet.flatMap((f) => ['-i', f]),
    '-filter_complex',
    `${sheet.map((_, i) => `[${i}:v]scale=-2:${sheetH}[v${i}]`).join(';')};${sheet.map((_, i) => `[v${i}]`).join('')}hstack=inputs=${sheet.length}`,
    '-frames:v',
    '1',
    join(RENDERS, `${name}.contact.png`),
  ]);
  spawnSync('rm', ['-rf', tmp]);
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(
    `✓ ${name}.mp4  ${(frames / FPS).toFixed(1)} s, ${frames} frames, ${placed} sounds (${secs} s to render)`,
  );
  results.push({ name, seconds: frames / FPS });
}

function run(cmd, argv) {
  const r = spawnSync(cmd, argv, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${cmd} failed (${r.status})`);
}

const skipped = [];
try {
  for (const format of formats) {
    for (const video of videos) {
      for (const lang of langs) {
        try {
          await render(video, lang, format);
        } catch (error) {
          if (error instanceof Missing && !strict) {
            skipped.push(`${video.id}.${lang}.${format}: ${error.message}`);
            console.log(`- skipped ${video.id}.${lang}.${format}: no ${error.message}`);
          } else throw error;
        }
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}
for (const r of results) {
  if (r.seconds < 15 || r.seconds > 22)
    console.log(`! ${r.name}: ${r.seconds.toFixed(1)} s is outside 15–22 s`);
}
writeFileSync(join(RENDERS, 'renders.json'), JSON.stringify({ results, skipped }, null, 1));
