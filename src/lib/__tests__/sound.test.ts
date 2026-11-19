import { setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';

import type * as SoundModule from '../sound';

describe('game sounds', () => {
  const load = (os: 'android' | 'ios') => {
    let mod!: typeof SoundModule;
    jest.isolateModules(() => {
      Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
      mod = jest.requireActual<typeof SoundModule>('../sound');
    });
    return mod;
  };

  it('Android: sounds play when the phone is on silent/vibrate (they follow the media volume)', () => {
    const sound = load('android');
    expect(sound.AUDIO_MODE.playsInSilentMode).toBe(true);
    sound.initSound();
    expect(jest.mocked(setAudioModeAsync)).toHaveBeenCalledWith(
      expect.objectContaining({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }),
    );
  });

  it('iPhone: the mute switch is respected', () => {
    expect(load('ios').AUDIO_MODE.playsInSilentMode).toBe(false);
  });

  it('there is no sound for menu buttons (only in-game sounds)', () => {
    const sound = load('android');
    // @ts-expect-error — 'tap' is not a sound
    sound.playSound('tap');
  });
});
