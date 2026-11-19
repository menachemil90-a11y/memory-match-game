/* eslint-disable import/first -- modules must load after jest.mock() */
import { Platform } from 'react-native';

const mockEnv = {
  otaEnabled: true,
  channel: 'preview' as string | null,
  build: '25' as string | null,
  repo: 'owner/memory-match-game' as string | undefined,
};

jest.mock('expo-updates', () => ({
  get isEnabled() {
    return mockEnv.otaEnabled;
  },
  get channel() {
    return mockEnv.channel;
  },
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(async () => ({ isNew: true })),
  reloadAsync: jest.fn(async () => undefined),
}));
const mockFile = { uri: 'file:///cache/apk-updates/memory-match-build30.apk' };
jest.mock('../apkInstaller', () => ({
  downloadApk: jest.fn(async (_apk: unknown, onProgress: (fraction: number) => void) => {
    onProgress(0.5);
    onProgress(1);
    return mockFile;
  }),
  openInstaller: jest.fn(async () => undefined),
  removeDownloadedApks: jest.fn(),
}));
jest.mock('expo-application', () => ({
  get nativeBuildVersion() {
    return mockEnv.build;
  },
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return { version: '0.2.0', extra: { apkReleasesRepo: mockEnv.repo } };
    },
  },
}));

import * as Updates from 'expo-updates';

import { downloadApk, openInstaller, removeDownloadedApks } from '../apkInstaller';
import { AUTO_CHECK_INTERVAL_MS, useUpdatesStore } from '../updatesStore';

const checkForUpdate = Updates.checkForUpdateAsync as jest.Mock;
const store = () => useUpdatesStore.getState();

function githubReturns(builds: number[]) {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () =>
      builds.map((b) => ({
        tag_name: `apk-0.2.0-build${b}`,
        draft: false,
        html_url: `https://github.com/r/${b}`,
        assets: [
          { name: `m-${b}.apk`, browser_download_url: `https://dl/${b}.apk`, size: 84_000_000 },
        ],
      })),
  });
}

beforeAll(() => {
  Object.defineProperty(Platform, 'OS', { get: () => 'android', configurable: true });
});

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockEnv, {
    otaEnabled: true,
    channel: 'preview',
    build: '25',
    repo: 'owner/memory-match-game',
  });
  useUpdatesStore.setState(useUpdatesStore.getInitialState(), true);
  checkForUpdate.mockResolvedValue({ isAvailable: false });
  global.fetch = jest.fn();
  githubReturns([25, 24]);
});

describe('checking for updates', () => {
  it('offers an over-the-air update first', async () => {
    checkForUpdate.mockResolvedValue({ isAvailable: true, manifest: { id: 'u1' } });
    await store().check({ manual: false });
    expect(store()).toMatchObject({
      status: 'available',
      available: { kind: 'ota', id: 'ota:u1' },
      promptOpen: true,
    });
  });

  it('offers a newer test APK from GitHub Releases', async () => {
    githubReturns([24, 27, 26]);
    await store().check({ manual: false });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/memory-match-game/releases?per_page=30',
      expect.anything(),
    );
    expect(store()).toMatchObject({
      status: 'available',
      promptOpen: true,
      available: {
        kind: 'apk',
        build: 27,
        version: '0.2.0',
        downloadUrl: 'https://dl/27.apk',
        size: 84_000_000,
      },
    });
  });

  it('is up to date when the newest test APK is this build', async () => {
    await store().check({ manual: true });
    expect(store()).toMatchObject({ status: 'upToDate', available: null, promptOpen: false });
  });

  it('never looks for APKs outside test builds (store builds update from the store)', async () => {
    mockEnv.channel = 'production';
    await store().check({ manual: true });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(store().status).toBe('upToDate');

    mockEnv.channel = 'preview';
    mockEnv.repo = undefined; // e.g. an EAS build: no releases repository baked in
    await store().check({ manual: true });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('reports a failed check (logged, shown in Settings) without opening the dialog', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));
    await store().check({ manual: false });
    expect(store()).toMatchObject({ status: 'checkFailed', promptOpen: false });
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });

  it('says so when this build cannot be updated (development / web)', async () => {
    mockEnv.otaEnabled = false;
    mockEnv.channel = null;
    await store().check({ manual: true });
    expect(store().status).toBe('unsupported');
  });

  it('checks in the background at most once an hour', async () => {
    await store().autoCheck();
    await store().autoCheck();
    expect(checkForUpdate).toHaveBeenCalledTimes(1);
    useUpdatesStore.setState({ lastCheckedAt: Date.now() - AUTO_CHECK_INTERVAL_MS - 1 });
    await store().autoCheck();
    expect(checkForUpdate).toHaveBeenCalledTimes(2);
  });
});

describe('asking the player', () => {
  it('"Later" is remembered: background checks don\'t ask again, a manual check does', async () => {
    checkForUpdate.mockResolvedValue({ isAvailable: true, manifest: { id: 'u1' } });
    await store().check({ manual: false });
    store().dismiss();
    expect(store().promptOpen).toBe(false);

    await store().check({ manual: false });
    expect(store().promptOpen).toBe(false);
    expect(store().status).toBe('available');

    await store().check({ manual: true });
    expect(store().promptOpen).toBe(true);
  });

  it('a newer update is offered even after "Later" on an older one', async () => {
    checkForUpdate.mockResolvedValue({ isAvailable: true, manifest: { id: 'u1' } });
    await store().check({ manual: false });
    store().dismiss();
    checkForUpdate.mockResolvedValue({ isAvailable: true, manifest: { id: 'u2' } });
    await store().check({ manual: false });
    expect(store().promptOpen).toBe(true);
  });

  it('"Update now" downloads the over-the-air update and restarts the app', async () => {
    checkForUpdate.mockResolvedValue({ isAvailable: true, manifest: { id: 'u1' } });
    await store().check({ manual: false });
    await store().install();
    expect(Updates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
    expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
  });

  it('"Install update" downloads the APK inside the app and opens the installer (no browser)', async () => {
    githubReturns([30]);
    await store().check({ manual: false });
    const progress: (number | null)[] = [];
    const unsubscribe = useUpdatesStore.subscribe((s) => progress.push(s.progress));
    await store().install();
    unsubscribe();
    expect(downloadApk).toHaveBeenCalledWith(
      expect.objectContaining({ build: 30, downloadUrl: 'https://dl/30.apk', size: 84_000_000 }),
      expect.any(Function),
    );
    expect(progress).toEqual(expect.arrayContaining([0, 0.5, 1]));
    expect(openInstaller).toHaveBeenCalledWith(mockFile);
    // Back in the app (installer closed without installing): it can be installed again.
    expect(store()).toMatchObject({ status: 'available', promptOpen: true, progress: null });
  });

  it('a failed APK download shows the error and can be retried', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    githubReturns([30]);
    await store().check({ manual: false });
    (downloadApk as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await store().install();
    expect(store()).toMatchObject({ status: 'installFailed', progress: null, promptOpen: true });
    expect(openInstaller).not.toHaveBeenCalled();
    await store().install();
    expect(openInstaller).toHaveBeenCalledTimes(1);
    errors.mockRestore();
  });

  it('removes a downloaded APK once no newer one is offered (installed)', async () => {
    await store().check({ manual: true }); // up to date: build 25 is the newest
    expect(removeDownloadedApks).toHaveBeenCalledTimes(1);
    githubReturns([30]);
    await store().check({ manual: true });
    expect(removeDownloadedApks).toHaveBeenCalledTimes(1);
  });

  it('a failed download keeps the dialog open with an error, and can be retried', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    checkForUpdate.mockResolvedValue({ isAvailable: true, manifest: { id: 'u1' } });
    (Updates.fetchUpdateAsync as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await store().check({ manual: false });
    await store().install();
    expect(store()).toMatchObject({ status: 'installFailed', promptOpen: true });
    expect(Updates.reloadAsync).not.toHaveBeenCalled();

    await store().install();
    expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
    errors.mockRestore();
  });
});
