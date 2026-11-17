# `src/game` — pure game engine (Phase 1)

Pure TypeScript: no React, no React Native, no Expo imports except through
injected dependencies (the crypto RNG and SHA-256 are passed in so the engine
runs unchanged in Jest, the app and — if practical — the Supabase Edge Functions).

Planned modules:

- `types.ts` — `GameState`, `Card`, `Player`, `GameAction`
- `levels.ts` — Tiny…Expert pairs/grid table and locked-level logic
- `reducer.ts` — `gameReducer(state, action)` implementing the tabletop rules
- `shuffle.ts` — Fisher–Yates with an injected secure RNG
- `layoutHistory.ts` — layout hashing and the "never the same board twice" check
- `scoring.ts` — solo star rating
