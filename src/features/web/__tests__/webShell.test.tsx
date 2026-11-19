import { fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import type * as ReactNative from 'react-native';

import HomeScreen from '@/app/index';
import JoinScreen from '@/app/join';
import { initI18n } from '@/lib/i18n';
import { APP_DOWNLOAD_URL } from '@/lib/links';
import { GameButton } from '@/ui/components';
import { renderScreen } from '@/test-utils/renderScreen';

import { AppOnlyDialog } from '../AppOnlyDialog';
import { openAppFeature, useAppOnlyPrompt } from '../appOnlyStore';
import { deviceKind, kindFromUserAgent, type DeviceKind } from '../device';
import { shareInvite } from '../../online/shareInvite.web';

/** The web game's capabilities, switched per test (the app's are the default). */
const mockCaps = { appFeatures: true, haptics: true, appUpdates: true, webShell: false };
jest.mock('@/lib/platform/capabilities', () => ({
  get capabilities() {
    return mockCaps;
  },
}));
const asWeb = () =>
  Object.assign(mockCaps, {
    appFeatures: false,
    haptics: false,
    appUpdates: false,
    webShell: true,
  });
const asApp = () =>
  Object.assign(mockCaps, { appFeatures: true, haptics: true, appUpdates: true, webShell: false });

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual<typeof ReactNative>('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
}));

let mockDevice: DeviceKind | null = null;
jest.mock('../device', () => {
  const actual = jest.requireActual<{ deviceKind: () => DeviceKind }>('../device');
  return { ...actual, deviceKind: () => mockDevice ?? actual.deviceKind() };
});

beforeAll(() => {
  initI18n();
});
beforeEach(() => {
  jest.clearAllMocks();
  asApp();
  useAppOnlyPrompt.setState({ visible: false, feature: null });
  mockDevice = null;
});

describe('app-only features', () => {
  it('in the app, the buttons open their screens', () => {
    openAppFeature('Solo', '/my-boards');
    expect(mockRouter.push).toHaveBeenCalledWith('/my-boards');
    expect(useAppOnlyPrompt.getState().visible).toBe(false);
  });

  it('in the web game, they explain the feature is in the app', () => {
    asWeb();
    openAppFeature('Solo', '/my-boards');
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(useAppOnlyPrompt.getState()).toMatchObject({ visible: true, feature: 'Solo' });
  });

  it('home in the web game: same buttons, app-only ones open the popup, plus Download', async () => {
    asWeb();
    mockDevice = 'android';
    await renderScreen(
      <>
        <HomeScreen />
        <AppOnlyDialog />
      </>,
    );
    expect(screen.getByRole('link', { name: 'Download the app' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '2 Players' }));
    expect(screen.getByText('Available in the app')).toBeTruthy();
    expect(screen.getByText(/^2 Players is part of the free Android app\./)).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Download/ })).toHaveLength(2);
    expect(mockRouter.push).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Play Online' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/online');
  });

  it('home in the app: no download button', async () => {
    await renderScreen(<HomeScreen />);
    expect(screen.queryByRole('link', { name: 'Download the app' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Solo' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/boards',
      params: { mode: 'solo' },
    });
  });
});

describe('invite links (/join/?c=CODE)', () => {
  it('go straight into the room', async () => {
    mockParams = { c: 'abc234' };
    await renderScreen(<JoinScreen />);
    expect(screen.getByText('redirect:/online/ABC234')).toBeTruthy();
  });

  it('without a valid code: the lobby', async () => {
    mockParams = { c: 'nope' };
    await renderScreen(<JoinScreen />);
    expect(screen.getByText('redirect:/online')).toBeTruthy();
  });
});

describe('devices and links', () => {
  it('on an iPhone, "Download the app" explains the app is Android-only', async () => {
    asWeb();
    mockDevice = 'ios';
    await renderScreen(
      <>
        <HomeScreen />
        <AppOnlyDialog />
      </>,
    );
    expect(screen.queryByRole('link', { name: 'Download the app' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Download the app' }));
    expect(screen.getByText(/The app is for Android phones only for now/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Download for Android' })).toBeNull();
  });

  it('tells Android, iPhone/iPad and other browsers apart', () => {
    expect(kindFromUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/131')).toBe(
      'android',
    );
    expect(kindFromUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('ios');
    expect(kindFromUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('ios');
    expect(kindFromUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe('other');
    expect(kindFromUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('other');
  });

  it('knows the app itself by its platform', () => {
    // In Jest (react-native preset) Platform.OS is "ios".
    expect(deviceKind()).toBe('ios');
  });

  it('a link button opens its URL in the app', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderScreen(<GameButton label="Get it" href={APP_DOWNLOAD_URL} />);
    await fireEvent.press(screen.getByRole('link', { name: 'Get it' }));
    expect(open).toHaveBeenCalledWith(APP_DOWNLOAD_URL);
  });
});

describe('sharing an invite on the web', () => {
  const nav = navigator as { share?: unknown };
  afterEach(() => {
    delete nav.share;
  });

  it("uses the browser's share sheet when there is one", async () => {
    const share = jest.fn(async () => undefined);
    nav.share = share;
    await expect(shareInvite('hi')).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: 'hi' });
  });

  it('a closed share sheet is not an error', async () => {
    nav.share = jest.fn(async () => {
      throw new DOMException('cancelled', 'AbortError');
    });
    await expect(shareInvite('hi')).resolves.toBe('dismissed');
  });

  it('otherwise copies the invite', async () => {
    const Clipboard = jest.requireMock<{ setStringAsync: jest.Mock }>('expo-clipboard');
    await expect(shareInvite('hi')).resolves.toBe('copied');
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('hi');
  });
});

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));
