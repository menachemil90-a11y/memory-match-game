#!/usr/bin/env node
/**
 * Synthesizes all game sounds from scratch (no samples), so they are 100% our
 * own and released as CC0. Output: assets/sounds/*.wav (+ music .m4a via ffmpeg).
 *
 * Run: npm run sounds
 */
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets/sounds');
const RATE = 44100;

// Deterministic noise so builds are reproducible.
let seed = 12345;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed / 2 ** 32) * 2 - 1;
};

const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const buffer = (seconds) => new Float32Array(Math.ceil(seconds * RATE));

/** Adds a tone with an attack/exponential-decay envelope and optional pitch glide. */
function tone(
  buf,
  {
    start = 0,
    freq,
    to = freq,
    dur,
    gain = 0.5,
    attack = 0.004,
    decay = 6,
    harmonics = [1],
    type = 'sine',
  },
) {
  const s0 = Math.floor(start * RATE);
  const n = Math.floor(dur * RATE);
  let phase = 0;
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    const t = i / RATE;
    const f = freq * (to / freq) ** (i / n);
    phase += (2 * Math.PI * f) / RATE;
    const env =
      Math.min(1, t / attack) * Math.exp(-decay * t) * Math.min(1, (n - i) / (RATE * 0.01));
    let v = 0;
    harmonics.forEach((amp, h) => {
      const p = phase * (h + 1);
      v += amp * (type === 'triangle' ? (2 / Math.PI) * Math.asin(Math.sin(p)) : Math.sin(p));
    });
    buf[s0 + i] += v * env * gain;
  }
}

/** Filtered noise burst (one-pole low-pass sweep) — used for the card "whoosh". */
function swish(buf, { start = 0, dur, gain = 0.3, from = 0.5, to = 0.05 }) {
  const s0 = Math.floor(start * RATE);
  const n = Math.floor(dur * RATE);
  let y = 0;
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    const k = from + (to - from) * (i / n);
    y += k * (noise() - y);
    const env = Math.sin((Math.PI * i) / n) ** 1.5;
    buf[s0 + i] += y * env * gain;
  }
}

const BELL = [1, 0.5, 0.25, 0.12];

function toWav(buf, peak = 0.9) {
  let max = 0;
  for (const v of buf) max = Math.max(max, Math.abs(v));
  const scale = max > 0 ? peak / max : 1;
  const data = Buffer.alloc(buf.length * 2);
  buf.forEach((v, i) =>
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * scale)) * 32767), i * 2),
  );
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const sounds = {
  flip() {
    const b = buffer(0.16);
    swish(b, { dur: 0.11, gain: 0.8, from: 0.6, to: 0.08 });
    tone(b, { start: 0.05, freq: 260, to: 180, dur: 0.09, gain: 0.5, decay: 45 });
    return toWav(b, 0.7);
  },
  deal() {
    const b = buffer(0.08);
    swish(b, { dur: 0.06, gain: 0.7, from: 0.8, to: 0.2 });
    return toWav(b, 0.45);
  },
  match() {
    const b = buffer(0.9);
    [72, 76, 79, 84].forEach((n, i) =>
      tone(b, { start: i * 0.07, freq: midi(n), dur: 0.7, gain: 0.35, decay: 5, harmonics: BELL }),
    );
    return toWav(b, 0.8);
  },
  miss() {
    const b = buffer(0.5);
    tone(b, {
      freq: midi(64),
      to: midi(62),
      dur: 0.18,
      gain: 0.4,
      decay: 8,
      type: 'triangle',
      attack: 0.01,
    });
    tone(b, {
      start: 0.16,
      freq: midi(60),
      to: midi(57),
      dur: 0.3,
      gain: 0.4,
      decay: 7,
      type: 'triangle',
      attack: 0.01,
    });
    return toWav(b, 0.55);
  },
  win() {
    const b = buffer(2.4);
    const run = [60, 64, 67, 72, 76, 79];
    run.forEach((n, i) =>
      tone(b, { start: i * 0.09, freq: midi(n), dur: 0.4, gain: 0.3, decay: 6, harmonics: BELL }),
    );
    // Final chord
    [72, 76, 79, 84].forEach((n) =>
      tone(b, {
        start: 0.6,
        freq: midi(n),
        dur: 1.7,
        gain: 0.25,
        decay: 1.8,
        harmonics: [1, 0.4, 0.15],
        attack: 0.02,
      }),
    );
    // Sparkles
    [96, 100, 103, 108, 103].forEach((n, i) =>
      tone(b, { start: 0.7 + i * 0.12, freq: midi(n), dur: 0.25, gain: 0.08, decay: 12 }),
    );
    return toWav(b, 0.85);
  },
  turn() {
    const b = buffer(0.35);
    tone(b, { freq: midi(79), dur: 0.15, gain: 0.3, decay: 14, harmonics: BELL });
    tone(b, { start: 0.1, freq: midi(84), dur: 0.22, gain: 0.3, decay: 10, harmonics: BELL });
    return toWav(b, 0.5);
  },
};

/** Gentle 8-bar loop: C – Am – F – G, plucked arpeggios + soft bass, 96 bpm. */
function music() {
  const bpm = 96;
  const beat = 60 / bpm;
  const bars = 8;
  const b = buffer(bars * 4 * beat);
  const chords = [
    [60, 64, 67],
    [57, 60, 64],
    [53, 57, 60],
    [55, 59, 62],
  ];
  const melody = [76, 74, 72, 74, 76, 76, 76, null, 74, 74, 74, null, 76, 79, 79, null];
  for (let bar = 0; bar < bars; bar++) {
    const chord = chords[bar % 4];
    const t0 = bar * 4 * beat;
    tone(b, {
      start: t0,
      freq: midi(chord[0] - 24),
      dur: 4 * beat,
      gain: 0.22,
      decay: 0.6,
      attack: 0.03,
      type: 'triangle',
    });
    for (let s = 0; s < 8; s++) {
      const note = chord[[0, 1, 2, 1, 0, 1, 2, 1][s]] + (s === 2 || s === 6 ? 12 : 0);
      tone(b, {
        start: t0 + (s * beat) / 2,
        freq: midi(note),
        dur: beat,
        gain: 0.1,
        decay: 5,
        harmonics: [1, 0.3, 0.1],
      });
    }
    if (bar >= 4) {
      for (let s = 0; s < 4; s++) {
        const n = melody[((bar - 4) * 4 + s) % melody.length];
        if (n)
          tone(b, {
            start: t0 + s * beat,
            freq: midi(n),
            dur: beat * 0.95,
            gain: 0.09,
            decay: 2.5,
            attack: 0.02,
            harmonics: [1, 0.15],
          });
      }
    }
  }
  return toWav(b, 0.5);
}

mkdirSync(OUT, { recursive: true });
for (const [name, make] of Object.entries(sounds)) writeFileSync(join(OUT, `${name}.wav`), make());

const tmp = join(OUT, 'music.tmp.wav');
writeFileSync(tmp, music());
execFileSync('ffmpeg', [
  '-y',
  '-loglevel',
  'error',
  '-i',
  tmp,
  '-c:a',
  'aac',
  '-b:a',
  '96k',
  join(OUT, 'music.m4a'),
]);
rmSync(tmp);
console.log(`Wrote ${Object.keys(sounds).length} sound effects + music loop to assets/sounds`);
