/* global jest */
// Shared Jest setup for screen tests (jest-expo has no mock for expo-audio).
jest.mock('expo-audio', () => {
  const player = () => ({
    volume: 1,
    loop: false,
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    seekTo: jest.fn(async () => undefined),
  });
  return {
    createAudioPlayer: jest.fn(player),
    setAudioModeAsync: jest.fn(async () => undefined),
  };
});

// Skia (confetti only) needs CanvasKit/WebAssembly; screen tests never draw it.
jest.mock('@shopify/react-native-skia', () => ({
  Canvas: () => null,
  Picture: () => null,
  Skia: {},
  createPicture: () => null,
}));
