import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests of the web game (e2e/web). By default they run against the
 * local export (`npm run build:web`), served like GitHub Pages; set
 * E2E_BASE_URL to test the live site instead. Tests that need the game server
 * (Supabase) run only with E2E_ONLINE=1 (CI can reach it; see web.yml).
 */
const LOCAL = 'http://localhost:8099/memory-match-game/';
const baseURL = process.env.E2E_BASE_URL ?? LOCAL;

export default defineConfig({
  testDir: 'e2e/web',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  // Online tests share one live game server: keep them in order, one at a time.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'off',
    serviceWorkers: 'block',
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'node e2e/serve-pages.cjs dist/web /memory-match-game 8099',
        url: LOCAL,
        reuseExistingServer: true,
      },
  projects: [
    {
      name: 'mobile',
      use: {
        viewport: { width: 360, height: 800 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 1,
      },
    },
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
  ],
});
