// Gradle settings for building the Android app, written into the generated
// android/gradle.properties so that every build — EAS cloud builds and the
// GitHub test-APK workflow — uses the same, tested values.
//
// Why: with the template defaults (4 CPU architectures, unlimited parallel
// workers, and a separate Kotlin compiler daemon as large as the Gradle one) a
// React Native New-Architecture release build doesn't fit a 4-core / 16 GB
// build machine. Gradle, the Kotlin daemon, Metro and several C++ compilers
// run at the same time and the system kills the biggest process:
//   EAS:    "Gradle build daemon disappeared unexpectedly (it may have been killed)"
//   GitHub: "The runner has received a shutdown signal"
// both while Metro bundles, Kotlin compiles and CMake builds native code.
const { withGradleProperties } = require('expo/config-plugins');

/** Values chosen for a 4-core / 16 GB build machine (EAS "medium", GitHub ubuntu-latest). */
const PROPERTIES = {
  // Gradle daemon heap (EAS sets the same value through GRADLE_OPTS).
  'org.gradle.jvmargs': '-Xmx4g -XX:MaxMetaspaceSize=1g',
  // Compile Kotlin inside that Gradle process instead of starting a second
  // multi-GB JVM (the Kotlin daemon) next to it.
  'kotlin.compiler.execution.strategy': 'in-process',
  // At most 3 parallel tasks (each C++ compile can take 1–1.5 GB).
  'org.gradle.workers.max': '3',
  // Phones only: arm64 (all current phones) + armv7 (older 32-bit phones).
  // x86/x86_64 are emulator-only and would double the native build.
  reactNativeArchitectures: 'armeabi-v7a,arm64-v8a',
};

/** Sets each of PROPERTIES in a parsed gradle.properties list (replacing existing values). */
function applyBuildProperties(items) {
  for (const [key, value] of Object.entries(PROPERTIES)) {
    const item = items.find((p) => p.type === 'property' && p.key === key);
    if (item) item.value = value;
    else items.push({ type: 'property', key, value });
  }
  return items;
}

function withAndroidBuildResources(config) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = applyBuildProperties(cfg.modResults);
    return cfg;
  });
}

module.exports = withAndroidBuildResources;
module.exports.PROPERTIES = PROPERTIES;
module.exports.applyBuildProperties = applyBuildProperties;
