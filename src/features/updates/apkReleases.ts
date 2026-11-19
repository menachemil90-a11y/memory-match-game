/**
 * Newer test APKs are published as GitHub Releases by the "Android test APK"
 * workflow, tagged `apk-<version>-build<run number>` with the .apk attached.
 * The run number is also the APK's Android versionCode (app.config.js), so the
 * app can tell whether a release is newer than itself.
 */

export interface ApkRelease {
  version: string;
  build: number;
  /** Direct link to the .apk file (the app downloads it). */
  downloadUrl: string;
  /** Size of the .apk in bytes. */
  size: number;
  /** The release page (fallback if the direct download can't be opened). */
  pageUrl: string;
}

const TAG = /^apk-(\d+\.\d+\.\d+)-build(\d+)$/;
// GitHub owner (letters, digits, inner hyphens) / repository (no "." or "..").
const REPO = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\/(?!\.\.?$)[A-Za-z0-9._-]+$/;
const TIMEOUT_MS = 15_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The newest test-APK release in a GitHub "list releases" response, if any. */
export function latestApkRelease(releases: unknown): ApkRelease | null {
  if (!Array.isArray(releases)) throw new Error('GitHub releases: unexpected response');
  let latest: ApkRelease | null = null;
  for (const release of releases) {
    if (!isRecord(release) || release.draft === true) continue;
    const match = typeof release.tag_name === 'string' ? TAG.exec(release.tag_name) : null;
    if (!match) continue;
    const assets = Array.isArray(release.assets) ? release.assets : [];
    const apk = assets.find(
      (a): a is { name: string; browser_download_url: string; size: number } =>
        isRecord(a) &&
        typeof a.name === 'string' &&
        a.name.endsWith('.apk') &&
        typeof a.browser_download_url === 'string' &&
        typeof a.size === 'number' &&
        a.size > 0,
    );
    if (!apk || typeof release.html_url !== 'string') continue;
    const build = Number(match[2]);
    if (!latest || build > latest.build) {
      latest = {
        version: match[1]!,
        build,
        downloadUrl: apk.browser_download_url,
        size: apk.size,
        pageUrl: release.html_url,
      };
    }
  }
  return latest;
}

export function isValidRepo(repo: unknown): repo is string {
  return typeof repo === 'string' && REPO.test(repo);
}

/** Asks GitHub for the newest test APK of `repo` ("owner/name"). */
export async function fetchLatestApkRelease(repo: string): Promise<ApkRelease | null> {
  if (!isValidRepo(repo)) throw new Error(`Invalid releases repository: ${repo}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=30`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`GitHub releases: HTTP ${res.status}`);
    return latestApkRelease(await res.json());
  } finally {
    clearTimeout(timer);
  }
}
