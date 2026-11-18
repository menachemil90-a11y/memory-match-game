// Dynamic part of the Expo config; all static values live in app.json.
//
// EAS Update channel: builds made by EAS Build get their channel from eas.json.
// Test APKs built by GitHub Actions (prebuild + Gradle) don't go through EAS
// Build, so the APK workflow sets EXPO_UPDATES_CHANNEL=preview and it is baked
// into the app here — then over-the-air updates published to "preview" reach
// those test phones.
module.exports = ({ config }) => {
  const channel = process.env.EXPO_UPDATES_CHANNEL;
  if (!channel) return config;
  return {
    ...config,
    updates: {
      ...config.updates,
      requestHeaders: { ...config.updates?.requestHeaders, 'expo-channel-name': channel },
    },
  };
};
