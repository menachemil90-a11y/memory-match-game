# `src/game` — pure game engine

Pure TypeScript: no React, React Native, Expo or Node imports (enforced by ESLint
and `__tests__/purity.test.ts`). Platform services are injected, so the same
code runs in Jest, in the app and on the server.

| Module       | What it does                                                               |
| ------------ | -------------------------------------------------------------------------- |
| `types.ts`   | `GameState`, `CardState`, `PlayerState`, `GameAction`, `LevelId`           |
| `levels.ts`  | Tiny…Expert table (pairs, cols × rows), locked-level logic and hints       |
| `engine.ts`  | `createGame`, `gameReducer` (flip / resolve / timeout), outcome, rematch   |
| `rng.ts`     | Unbiased integers from an injected secure byte source (rejection sampling) |
| `shuffle.ts` | Fisher–Yates shuffle and random subset                                     |
| `deal.ts`    | Layout hashing and `dealUniqueLayout` — "never the same board twice"       |
| `scoring.ts` | Solo 1–3 star rating and best-score comparison                             |

## Turn flow

```
awaitingFirst --flip--> awaitingSecond --flip--> resolving --resolve--> awaitingFirst
                                                     |  match: same player, pair collected
                                                     |  mismatch: cards flip back, turn passes
                                                     '--> finished (last pair)
```

The UI dispatches `resolve` after its match/mismatch animation (or as soon as
the board is tapped during a mismatch). `timeout` (online turn timer) flips any
open card back and passes the turn.

## No-repeat dealing

`dealUniqueLayout` picks a random image subset, doubles and shuffles it, hashes
the layout (SHA-256 of its JSON) and rejects any hash already in the history
for that (board, level). Spaces of ≤ 5000 layouts (e.g. Tiny on a 3–7 image
board) are enumerated so the choice among unused layouts is exact. When every
layout has been played the history resets but the last 10 stay forbidden.
