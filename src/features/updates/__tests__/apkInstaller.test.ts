/** @jest-environment node */
import * as IntentLauncher from 'expo-intent-launcher';

import { downloadApk, openInstaller, removeDownloadedApks } from '../apkInstaller';

/** A tiny in-memory stand-in for expo-file-system's File/Directory. */
const mockFiles = new Map<string, number>(); // uri → size
const mockDirs = new Set<string>();
let mockServedSize = 0;
jest.mock('expo-file-system', () => {
  class Directory {
    uri: string;
    constructor(parent: { uri: string } | string, name: string) {
      this.uri = `${typeof parent === 'string' ? parent : parent.uri}/${name}`;
    }
    get exists() {
      return mockDirs.has(this.uri);
    }
    create() {
      mockDirs.add(this.uri);
    }
    delete() {
      mockDirs.delete(this.uri);
      for (const uri of [...mockFiles.keys()]) if (uri.startsWith(this.uri)) mockFiles.delete(uri);
    }
  }
  class File {
    uri: string;
    constructor(dir: { uri: string }, name: string) {
      this.uri = `${dir.uri}/${name}`;
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    get size() {
      return mockFiles.get(this.uri) ?? null;
    }
    delete() {
      mockFiles.delete(this.uri);
    }
    static createDownloadTask(
      _url: string,
      dest: File,
      options: { onProgress: (p: { bytesWritten: number; totalBytes: number }) => void },
    ) {
      return {
        downloadAsync: async () => {
          options.onProgress({ bytesWritten: mockServedSize / 2, totalBytes: mockServedSize });
          mockFiles.set(dest.uri, mockServedSize);
          options.onProgress({ bytesWritten: mockServedSize, totalBytes: mockServedSize });
          return dest;
        },
      };
    }
  }
  return { Directory, File, Paths: { cache: 'file:///cache' } };
});
jest.mock('expo-file-system/legacy', () => ({
  getContentUriAsync: jest.fn(async (uri: string) =>
    uri.replace('file:///cache', 'content://app.provider/cached_expo_files'),
  ),
}));
jest.mock('expo-intent-launcher', () => ({
  startActivityAsync: jest.fn(async () => ({ resultCode: 0 })),
}));

const apk = { build: 46, downloadUrl: 'https://x/memory-match.apk', size: 1000 };

beforeEach(() => {
  mockFiles.clear();
  mockDirs.clear();
  mockServedSize = 1000;
  jest.clearAllMocks();
});

describe('in-app APK install', () => {
  it('downloads into the app cache with progress', async () => {
    const progress: number[] = [];
    const file = await downloadApk(apk, (p) => progress.push(p));
    expect(file.uri).toBe('file:///cache/apk-updates/memory-match-build46.apk');
    expect(progress).toEqual([0.5, 1]);
  });

  it('reuses a complete earlier download (e.g. the installer was closed)', async () => {
    await downloadApk(apk, () => undefined);
    mockServedSize = 0; // would fail if downloaded again
    const progress: number[] = [];
    await downloadApk(apk, (p) => progress.push(p));
    expect(progress).toEqual([1]);
  });

  it('rejects and removes an incomplete download', async () => {
    mockServedSize = 400;
    await expect(downloadApk(apk, () => undefined)).rejects.toThrow('Incomplete APK download');
    expect(mockFiles.size).toBe(0);
  });

  it("opens Android's installer for the file, allowed to read it", async () => {
    const file = await downloadApk(apk, () => undefined);
    await openInstaller(file);
    expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith('android.intent.action.VIEW', {
      data: 'content://app.provider/cached_expo_files/apk-updates/memory-match-build46.apk',
      type: 'application/vnd.android.package-archive',
      flags: 1,
    });
  });

  it('cleans up downloaded APKs', async () => {
    await downloadApk(apk, () => undefined);
    removeDownloadedApks();
    expect(mockFiles.size).toBe(0);
  });
});
