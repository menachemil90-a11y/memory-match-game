# `src/game` — pure game engine

Pure TypeScript: no React, React Native, Expo or Node imports (enforced by ESLint
and `__tests__/purity.test.ts`). Platform services are injected, so the same
code runs in Jest, in the app and on the server.

| Module       | What it does                                                               |
| ------------ | -------------------------------------------------------------------------- |
| `types.ts`   | `GameState`, `CardState`, `PlayerState`, `GameAction`, `LevelId`           |
| `levels.ts`  | Tiny…Expert table (pairs, cols × rows), locked-level logic and hints       |
| `players.ts` | `MAX_PLAYERS` (8) and the smallest board per player count                  |
| `engine.ts`  | `createGame`, `gameReducer` (flip / resolve / timeout / leave), ranking    |
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
open card back and passes the turn. `leave` (online) marks a player as gone: their
turns are skipped, and once one player is left the game ends.

## Players

2–8 players (`MAX_PLAYERS`, mirrored by the server's `app_config.max_players`). So
that nobody is left without turns, bigger groups need bigger boards
(`minPairsForPlayers`): 2 players → any level, 3–4 → at least 8 pairs, 5–8 → at
least 12. `createGame` rejects other combinations. A miss passes the turn to the
next player in seating order who is still in the game. `getRanking` ranks by
pairs with shared places for ties (1, 1, 3); players who left rank after everyone
who stayed.

## No-repeat dealing

`dealUniqueLayout` picks a random image subset, doubles and shuffles it, hashes
the layout (SHA-256 of its JSON) and rejects any hash already in the history
for that (board, level). Spaces of ≤ 5000 layouts (e.g. Tiny on a 3–7 image
board) are enumerated so the choice among unused layouts is exact. When every
layout has been played the history resets but the last 10 stay forbidden.
