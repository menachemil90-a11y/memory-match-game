import Constants from 'expo-constants';

export const APP_VERSION_LABEL = Constants.expoConfig?.version ?? '0.0.0';

/**
 * Public URL of the privacy policy (required by Google Play / App Store).
 * Placeholder until the policy in docs/PRIVACY_POLICY.md is hosted.
 */
export const PRIVACY_POLICY_URL = '';

export const LICENSE_URLS = {
  twemoji: 'https://creativecommons.org/licenses/by/4.0/',
  fredoka: 'https://openfontlicense.org/open-font-license-official-text/',
  ionicons: 'https://github.com/ionic-team/ionicons/blob/main/LICENSE',
} as const;
