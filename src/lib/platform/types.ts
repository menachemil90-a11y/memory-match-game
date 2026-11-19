/** What this build of the game can do. See capabilities.ts (app) and capabilities.web.ts (web). */
export interface Capabilities {
  /**
   * Solo, 2 players on one phone, photo boards, best scores: everything that
   * needs the device database and files. The web game is online play only.
   */
  appFeatures: boolean;
  /** Vibration feedback. */
  haptics: boolean;
  /** Over-the-air updates and the "new test APK" check. */
  appUpdates: boolean;
  /** The web shell: phone-width column, "Download the app" bar and popups. */
  webShell: boolean;
}
