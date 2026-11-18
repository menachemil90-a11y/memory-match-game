import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import * as Haptics from 'expo-haptics';

import { feedback } from '../feedback';
import { playSound, type SoundEffect } from '../sound';

const mockSettings = { hapticsEnabled: true, soundEnabled: true };
jest.mock('@/features/settings/settingsStore', () => ({
  useSettingsStore: { getState: () => mockSettings },
}));
jest.mock('../sound', () => ({ playSound: jest.fn() }));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => undefined),
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Soft: 'soft' },
  NotificationFeedbackType: { Success: 'success' },
}));

const SOUNDS_DIR = join(__dirname, '../../../assets/sounds');

beforeEach(() => jest.clearAllMocks());

describe('UI tap feedback', () => {
  it('plays no sound for menu/button taps — only a light vibration', () => {
    mockSettings.hapticsEnabled = true;
    feedback.tap();
    expect(playSound).not.toHaveBeenCalled();
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('respects the Vibration setting', () => {
    mockSettings.hapticsEnabled = false;
    feedback.tap();
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    expect(playSound).not.toHaveBeenCalled();
  });

  it('has no "tap" sound any more (type and file), so it cannot come back by mistake', () => {
    // @ts-expect-error — 'tap' is not a sound effect.
    const tap: SoundEffect = 'tap';
    expect(tap).toBe('tap');
    expect(existsSync(join(SOUNDS_DIR, 'tap.wav'))).toBe(false);
  });
});

describe('in-game sounds stay exactly as they were', () => {
  it.each([
    ['deal', () => feedback.deal()],
    ['flip', () => feedback.flip()],
    ['match', () => feedback.match()],
    ['miss', () => feedback.miss()],
    ['turn', () => feedback.turn()],
    ['win', () => feedback.win()],
  ])('%s plays its sound', (name, play) => {
    mockSettings.hapticsEnabled = true;
    play();
    expect(playSound).toHaveBeenCalledWith(name);
  });

  it('keeps every in-game sound file and the music', () => {
    expect(readdirSync(SOUNDS_DIR).sort()).toEqual(
      ['deal.wav', 'flip.wav', 'match.wav', 'miss.wav', 'music.m4a', 'turn.wav', 'win.wav'].sort(),
    );
  });
});
