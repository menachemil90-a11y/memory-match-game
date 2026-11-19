import { Directory, File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

/**
 * In-app installation of a new test APK (Android test builds only — see
 * updatesStore): the app downloads the APK into its own cache, then hands it
 * to Android's package installer. No browser, no Downloads folder.
 *
 * Needs the REQUEST_INSTALL_PACKAGES permission, which only test APKs get
 * (app.config.js); the first time, Android asks the player to allow installs
 * from this app. Google Play builds never do this: the store updates them.
 */

const APK_MIME = 'application/vnd.android.package-archive';
/** Intent.FLAG_GRANT_READ_URI_PERMISSION: the installer may read our file. */
const FLAG_GRANT_READ_URI_PERMISSION = 1;

const downloadsDir = () => new Directory(Paths.cache, 'apk-updates');

export interface ApkToInstall {
  build: number;
  downloadUrl: string;
  /** Expected size in bytes (from the release), to detect incomplete downloads. */
  size: number;
}

/**
 * Downloads the APK (reusing an earlier complete download of the same build).
 * `onProgress` gets 0..1.
 */
export async function downloadApk(
  apk: ApkToInstall,
  onProgress: (fraction: number) => void,
): Promise<File> {
  const dir = downloadsDir();
  dir.create({ intermediates: true, idempotent: true });
  const file = new File(dir, `memory-match-build${apk.build}.apk`);
  if (file.exists && file.size === apk.size) {
    onProgress(1);
    return file;
  }
  if (file.exists) file.delete();
  const task = File.createDownloadTask(apk.downloadUrl, file, {
    onProgress: ({ bytesWritten }) => onProgress(Math.min(1, bytesWritten / apk.size)),
  });
  const downloaded = await task.downloadAsync();
  if (!downloaded) throw new Error('The APK download was paused');
  if (downloaded.size !== apk.size) {
    downloaded.delete();
    throw new Error(`Incomplete APK download: ${downloaded.size} of ${apk.size} bytes`);
  }
  return downloaded;
}

/**
 * Opens Android's installer for the downloaded APK. Resolves when the player
 * comes back to the app without installing (after installing, Android
 * replaces the running app).
 */
export async function openInstaller(file: File): Promise<void> {
  const contentUri = await getContentUriAsync(file.uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: APK_MIME,
    flags: FLAG_GRANT_READ_URI_PERMISSION,
  });
}

/** Removes downloaded APKs once they are no longer needed (installed or outdated). */
export function removeDownloadedApks(): void {
  const dir = downloadsDir();
  if (dir.exists) dir.delete();
}
