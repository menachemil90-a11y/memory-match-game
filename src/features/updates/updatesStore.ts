import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Linking, Platform } from 'react-native';
import { create } from 'zustand';

import { fetchLatestApkRelease, isValidRepo } from './apkReleases';

/**
 * App updates, always with the player's consent (app.json:
 * updates.checkAutomatically = NEVER, so nothing downloads by itself):
 * - over-the-air (EAS Update): new JavaScript/assets for this app version —
 *   "Update now" downloads it and restarts the app in a few seconds;
 * - new test APK (GitHub Releases): only in test builds (update channel
 *   "preview" with a known build number and releases repository) — "Download"
 *   opens the .apk in the browser. Store builds never self-update this way
 *   (not allowed by Google Play); they get new versions from the store.
 */

export type AvailableUpdate =
  | { kind: 'ota'; id: string }
  | { kind: 'apk'; id: string; version: string; build: number; downloadUrl: string };

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'upToDate'
  | 'available'
  | 'installing'
  | 'checkFailed'
  | 'installFailed'
  | 'unsupported';

/** Background checks (app start / back to the app) at most this often. */
export const AUTO_CHECK_INTERVAL_MS = 60 * 60 * 1000;
/** Update channel of the GitHub-built test APKs (see app.config.js). */
export const TEST_APK_CHANNEL = 'preview';

export function currentBuild(): number | null {
  const n = Number(Application.nativeBuildVersion);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function releasesRepo(): string | null {
  const repo = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)
    ?.apkReleasesRepo;
  return isValidRepo(repo) ? repo : null;
}

function apkUpdatesSupported(): boolean {
  return (
    Platform.OS === 'android' &&
    Updates.channel === TEST_APK_CHANNEL &&
    releasesRepo() !== null &&
    currentBuild() !== null
  );
}

async function findUpdate(): Promise<AvailableUpdate | null> {
  if (Updates.isEnabled) {
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) {
      return { kind: 'ota', id: `ota:${result.manifest?.id ?? 'new'}` };
    }
  }
  if (apkUpdatesSupported()) {
    const latest = await fetchLatestApkRelease(releasesRepo()!);
    if (latest && latest.build > currentBuild()!) {
      return {
        kind: 'apk',
        id: `apk:${latest.build}`,
        version: latest.version,
        build: latest.build,
        downloadUrl: latest.downloadUrl,
      };
    }
  }
  return null;
}

interface UpdatesState {
  status: UpdateStatus;
  available: AvailableUpdate | null;
  /** The "new version" dialog is wanted (it waits while a game is running). */
  promptOpen: boolean;
  lastCheckedAt: number | null;
  /** Updates the player answered "Later" to; background checks don't re-ask this session. */
  dismissed: string[];
  check: (options: { manual: boolean }) => Promise<void>;
  /** Background check, skipped if one ran within AUTO_CHECK_INTERVAL_MS. */
  autoCheck: () => Promise<void>;
  install: () => Promise<void>;
  dismiss: () => void;
}

export const useUpdatesStore = create<UpdatesState>()((set, get) => ({
  status: 'idle',
  available: null,
  promptOpen: false,
  lastCheckedAt: null,
  dismissed: [],

  check: async ({ manual }) => {
    const { status } = get();
    if (status === 'checking' || status === 'installing') return;
    if (!Updates.isEnabled && !apkUpdatesSupported()) {
      set({ status: 'unsupported' });
      return;
    }
    set({ status: 'checking' });
    try {
      const available = await findUpdate();
      const askAgain = available !== null && (manual || !get().dismissed.includes(available.id));
      set({
        status: available ? 'available' : 'upToDate',
        available,
        promptOpen: askAgain,
        lastCheckedAt: Date.now(),
      });
    } catch (error) {
      console.error('Update check failed', error);
      set({ status: 'checkFailed', lastCheckedAt: Date.now() });
    }
  },

  autoCheck: async () => {
    const { lastCheckedAt, check } = get();
    if (lastCheckedAt !== null && Date.now() - lastCheckedAt < AUTO_CHECK_INTERVAL_MS) return;
    await check({ manual: false });
  },

  install: async () => {
    const { available } = get();
    if (!available) return;
    set({ status: 'installing' });
    try {
      if (available.kind === 'ota') {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      } else {
        await Linking.openURL(available.downloadUrl);
        set({ status: 'available', promptOpen: false });
      }
    } catch (error) {
      console.error('Installing the update failed', error);
      set({ status: 'installFailed' });
    }
  },

  dismiss: () => {
    const { available, dismissed, status } = get();
    set({
      promptOpen: false,
      dismissed: available ? [...dismissed, available.id] : dismissed,
      status: status === 'installFailed' ? 'available' : status,
    });
  },
}));
