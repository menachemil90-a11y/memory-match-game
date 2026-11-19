/* eslint-disable import/first -- modules must load after jest.mock() */
/**
 * The real update dialog and Settings section against mocked expo-updates /
 * expo-application: when the dialog appears, that it waits during a game, and
 * what its buttons do.
 */
const mockRoute = { pathname: '/' };
jest.mock('expo-router', () => ({ usePathname: () => mockRoute.pathname }));
jest.mock('expo-updates', () => ({
  isEnabled: true,
  channel: 'preview',
  isEmbeddedLaunch: true,
  createdAt: null,
  checkForUpdateAsync: jest.fn(async () => ({ isAvailable: false })),
  fetchUpdateAsync: jest.fn(async () => ({ isNew: true })),
  reloadAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-application', () => ({ nativeBuildVersion: '25' }));

import { act, fireEvent, screen } from '@testing-library/react-native';
import * as Updates from 'expo-updates';

import { initI18n } from '@/lib/i18n';
import { renderScreen } from '@/test-utils/renderScreen';

import { isBusyScreen, UpdatePrompt } from '../UpdatePrompt';
import { UpdatesSection } from '../UpdatesSection';
import { useUpdatesStore } from '../updatesStore';

const otaWaiting = () =>
  useUpdatesStore.setState({
    status: 'available',
    available: { kind: 'ota', id: 'ota:u1' },
    promptOpen: true,
    lastCheckedAt: Date.now(), // no background check during the test
  });

beforeAll(() => initI18n());
beforeEach(() => {
  jest.clearAllMocks();
  mockRoute.pathname = '/';
  useUpdatesStore.setState(useUpdatesStore.getInitialState(), true);
});

describe('update dialog', () => {
  it('waits while a game is running (local or online), not in menus', () => {
    expect(isBusyScreen('/game')).toBe(true);
    expect(isBusyScreen('/online/K7QX')).toBe(true);
    expect(isBusyScreen('/online')).toBe(false);
    expect(isBusyScreen('/online/new')).toBe(false);
    expect(isBusyScreen('/results')).toBe(false);
    expect(isBusyScreen('/')).toBe(false);
  });

  it('checks for updates when the app starts', async () => {
    await renderScreen(<UpdatePrompt />);
    await act(async () => undefined);
    expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
  });

  it('asks before an over-the-air update and installs it on "Update now"', async () => {
    otaWaiting();
    await renderScreen(<UpdatePrompt />);
    expect(screen.getByText('Update available')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('update-install'));
    expect(Updates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
    expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
  });

  it('is not shown during a game, and appears after it', async () => {
    otaWaiting();
    mockRoute.pathname = '/game';
    const view = await renderScreen(<UpdatePrompt />);
    expect(screen.queryByText('Update available')).toBeNull();
    mockRoute.pathname = '/results';
    await view.rerender(<UpdatePrompt />);
    expect(screen.getByText('Update available')).toBeTruthy();
  });

  it('"Later" closes it without updating', async () => {
    otaWaiting();
    await renderScreen(<UpdatePrompt />);
    await fireEvent.press(screen.getByTestId('update-later'));
    expect(screen.queryByText('Update available')).toBeNull();
    expect(Updates.fetchUpdateAsync).not.toHaveBeenCalled();
  });

  it('offers a new test APK with its version and build', async () => {
    useUpdatesStore.setState({
      status: 'available',
      available: {
        kind: 'apk',
        id: 'apk:30',
        version: '0.2.0',
        build: 30,
        downloadUrl: 'https://dl/30.apk',
        size: 84_000_000,
      },
      promptOpen: true,
      lastCheckedAt: Date.now(),
    });
    await renderScreen(<UpdatePrompt />);
    expect(screen.getByText('New version available')).toBeTruthy();
    expect(screen.getByText(/Version 0\.2\.0 \(build 30\) is ready/)).toBeTruthy();
    expect(screen.getByText('Install update')).toBeTruthy();
  });

  it('shows the download progress inside the dialog', async () => {
    useUpdatesStore.setState({
      status: 'installing',
      progress: 0.42,
      available: {
        kind: 'apk',
        id: 'apk:30',
        version: '0.2.0',
        build: 30,
        downloadUrl: 'https://dl/30.apk',
        size: 84_000_000,
      },
      promptOpen: true,
      lastCheckedAt: Date.now(),
    });
    await renderScreen(<UpdatePrompt />);
    expect(screen.getByText('Downloading… 42%')).toBeTruthy();
  });
});

describe('Settings → Updates', () => {
  it('shows the version and build, and checks on demand', async () => {
    await renderScreen(<UpdatesSection />);
    expect(screen.getByText(/^Version \d+\.\d+\.\d+ \(build 25\)$/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('updates-check'));
    expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('updates-status')).toHaveTextContent('You have the latest version.');
  });
});
