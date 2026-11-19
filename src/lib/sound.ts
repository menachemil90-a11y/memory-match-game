import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { AppState, Platform } from 'react-native';

import { useSettingsStore } from '@/features/settings/settingsStore';

/*
 * Sound files are synthesized by scripts/synth-audio.mjs (our own, CC0).
 * In-game sounds only: menu/button taps are silent by design (haptics only).
 */
const SOURCES = {
  flip: require('../../assets/sounds/flip.wav') as number,
  deal: require('../../assets/sounds/deal.wav') as number,
  match: require('../../assets/sounds/match.wav') as number,
  miss: require('../../assets/sounds/miss.wav') as number,
  win: require('../../assets/sounds/win.wav') as number,
  turn: require('../../assets/sounds/turn.wav') as number,
};
const MUSIC = require('../../assets/sounds/music.m4a') as number;

export type SoundEffect = keyof typeof SOURCES;

/** Several players for sounds that can overlap (e.g. fast flips, deal ticks). */
const POOL_SIZE: Partial<Record<SoundEffect, number>> = { flip: 2, deal: 3 };
const VOLUME: Record<SoundEffect, number> = {
  flip: 0.8,
  deal: 0.5,
  match: 0.9,
  miss: 0.7,
  win: 1,
  turn: 0.7,
};
const MUSIC_VOLUME = 0.32;

let pools: Partial<Record<SoundEffect, { players: AudioPlayer[]; next: number }>> = {};
let music: AudioPlayer | null = null;
let musicWanted = false;
let initialized = false;

function safely(fn: () => void): void {
  try {
    fn();
  } catch {
    // Audio must never crash the game (e.g. audio focus lost, device quirks).
  }
}

/**
 * How the game's sounds behave. Android: game sounds follow the MEDIA volume,
 * like every game — with `playsInSilentMode: false` expo-audio would mute them
 * whenever the phone is on silent or vibrate (that silenced the game on testers'
 * phones). iPhone: the mute switch is respected, as iPhone games do.
 */
export const AUDIO_MODE = {
  playsInSilentMode: Platform.OS === 'android',
  interruptionMode: 'mixWithOthers',
  shouldPlayInBackground: false,
} as const;

/** Creates the players once. Safe to call many times. */
export function initSound(): void {
  if (initialized) return;
  initialized = true;
  void setAudioModeAsync(AUDIO_MODE).catch(() => undefined);

  pools = {};
  for (const [name, source] of Object.entries(SOURCES) as [SoundEffect, number][]) {
    const size = POOL_SIZE[name] ?? 1;
    const players: AudioPlayer[] = [];
    for (let i = 0; i < size; i++) {
      safely(() => {
        const player = createAudioPlayer(source);
        player.volume = VOLUME[name];
        players.push(player);
      });
    }
    pools[name] = { players, next: 0 };
  }

  AppState.addEventListener('change', (state) => {
    if (state === 'active') syncMusic();
    else safely(() => music?.pause());
  });
  useSettingsStore.subscribe(syncMusic);
}

export function playSound(name: SoundEffect): void {
  if (!useSettingsStore.getState().soundEnabled) return;
  const pool = pools[name];
  const player = pool?.players[pool.next];
  if (!pool || !player) return;
  pool.next = (pool.next + 1) % pool.players.length;
  safely(() => {
    void player.seekTo(0).catch(() => undefined);
    player.play();
  });
}

function syncMusic(): void {
  const shouldPlay =
    musicWanted && useSettingsStore.getState().musicEnabled && AppState.currentState === 'active';
  safely(() => {
    if (shouldPlay) {
      if (!music) {
        music = createAudioPlayer(MUSIC);
        music.loop = true;
        music.volume = MUSIC_VOLUME;
      }
      if (!music.playing) music.play();
    } else {
      music?.pause();
    }
  });
}

/** Background music plays while the app is open and the setting is on. */
export function setMusicWanted(wanted: boolean): void {
  musicWanted = wanted;
  syncMusic();
}
