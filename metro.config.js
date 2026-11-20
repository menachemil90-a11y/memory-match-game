// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web build loads a WebAssembly module.
config.resolver.assetExts.push('wasm');

// Promo videos only: a capture-only web build of the full app (never deployed).
if (process.env.PROMO_CAPTURE === '1') {
  require('./promo/capture/metro-capture.cjs')(config);
}

module.exports = config;
