/**
 * CAPTURE-ONLY web build of the full app, for filming promo videos of screens that
 * only exist in the app (Solo, 2 Players on one phone). Used only when
 * PROMO_CAPTURE=1 (promo/capture/build-capture-web.mjs); never deployed — the
 * shipped web game (npm run build:web) never sets it.
 *
 * On the web the game normally resolves these modules to their `.web` files (online
 * play only, no device database, the download bar). Here they resolve to the app's
 * versions instead. The settings/session store stays on localStorage
 * (kvStorage.web.ts), so a capture can hand the page an online session.
 */
const APP_ON_WEB =
  /[\\/]src[\\/](lib[\\/]platform[\\/]capabilities|lib[\\/]db[\\/]index|features[\\/]web[\\/]WebShell)\.web\.tsx?$/;

module.exports = function useAppModulesOnWeb(config) {
  const upstream = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const resolved = (upstream ?? context.resolveRequest)(context, moduleName, platform);
    if (
      platform === 'web' &&
      resolved.type === 'sourceFile' &&
      APP_ON_WEB.test(resolved.filePath)
    ) {
      return { type: 'sourceFile', filePath: resolved.filePath.replace(/\.web(\.tsx?)$/, '$1') };
    }
    return resolved;
  };
  return config;
};
