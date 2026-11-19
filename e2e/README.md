# End-to-end tests of the web game

The web game is the same app exported for browsers (online play only), published on
GitHub Pages by `.github/workflows/web.yml`. Its tests live in `e2e/web` (Playwright).

```bash
npm run build:web                           # → dist/web (see scripts/build-web.mjs)
npx playwright test --trace off             # serves dist/web like GitHub Pages and tests it
E2E_ONLINE=1 npx playwright test --trace off            # + two-browser online games (needs the game server)
E2E_BASE_URL=https://…/memory-match-game/ E2E_ONLINE=1 npx playwright test --trace off   # the live site
```

- `e2e/serve-pages.cjs` serves the export like GitHub Pages: under the site's sub-path,
  folders serve their `index.html`, anything else gets `404.html` with status 404.
- `site.spec.ts`: home, download links, "Available in the app" popups, app-only routes,
  invite links (old and new), link previews, Android "Open in app", iPhone, desktop column.
- `online.spec.ts` (`E2E_ONLINE=1`): two separate browsers play complete games — from an
  invite link, by typed code, from a room link opened fresh (incl. a reload mid-game) —
  plus a rematch; a web guest sees a host's photo cards (skipped until the photo-room
  migration is on the server). Runs in CI (the development sandbox can't reach Supabase).
- Both run on a 360×800 phone viewport and a 1280×800 desktop; every test fails on console
  errors.
