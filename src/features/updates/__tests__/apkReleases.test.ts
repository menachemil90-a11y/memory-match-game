/** @jest-environment node */
import { isValidRepo, latestApkRelease } from '../apkReleases';

const release = (tag: string, extra: Record<string, unknown> = {}) => ({
  tag_name: tag,
  draft: false,
  prerelease: true,
  html_url: `https://github.com/o/r/releases/tag/${tag}`,
  assets: [
    { name: 'notes.txt', browser_download_url: 'https://x/notes.txt' },
    {
      name: `memory-match-${tag}.apk`,
      browser_download_url: `https://x/${tag}.apk`,
      size: 84_000_000,
    },
  ],
  ...extra,
});

describe('newest test APK in GitHub Releases', () => {
  it('picks the highest build number, whatever the list order', () => {
    const latest = latestApkRelease([
      release('apk-0.2.0-build25'),
      release('apk-0.2.0-build31'),
      release('apk-0.1.0-build24'),
    ]);
    expect(latest).toEqual({
      version: '0.2.0',
      build: 31,
      downloadUrl: 'https://x/apk-0.2.0-build31.apk',
      size: 84_000_000,
      pageUrl: 'https://github.com/o/r/releases/tag/apk-0.2.0-build31',
    });
  });

  it('ignores drafts, other tags and releases without an .apk file', () => {
    expect(
      latestApkRelease([
        release('apk-0.2.0-build40', { draft: true }),
        release('v1.0.0'),
        release('apk-0.2.0-build39', { assets: [] }),
        release('apk-0.2.0-build26'),
      ])?.build,
    ).toBe(26);
    expect(latestApkRelease([])).toBeNull();
  });

  it('rejects a response that is not a release list (reported, not ignored)', () => {
    expect(() => latestApkRelease({ message: 'API rate limit exceeded' })).toThrow();
  });

  it('accepts only "owner/name" repositories', () => {
    expect(isValidRepo('someone/memory-match-game')).toBe(true);
    expect(isValidRepo('../etc')).toBe(false);
    expect(isValidRepo('a/b/c')).toBe(false);
    expect(isValidRepo('owner/..')).toBe(false);
    expect(isValidRepo('owner/x?per_page=1')).toBe(false);
    expect(isValidRepo(undefined)).toBe(false);
  });
});
