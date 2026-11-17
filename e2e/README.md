# Web smoke test (development only)

Plays complete Solo and 2-player games in a headless browser by reading the
cards' accessibility labels — a fast end-to-end check of the game flow.

```bash
npx expo export --platform web --output-dir /tmp/mm-web
node e2e/serve-static.cjs /tmp/mm-web &        # serves on :8099 with COOP/COEP for expo-sqlite
node e2e/play-web.cjs /tmp/mm-shots            # needs Playwright (npm i -g playwright)
```

Screenshots are written to the given folder. Native-only features (Skia
confetti, haptics) are no-ops on web.
