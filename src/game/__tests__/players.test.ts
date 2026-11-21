/** @jest-environment node */
import {
  LEVELS,
  MAX_PLAYERS,
  createGame,
  gameReducer,
  getOutcome,
  getRanking,
  isFinished,
  isLevelAllowedForPlayers,
  maxPlayersForLevel,
  minPairsForPlayers,
  randomLayout,
  rematchStartingPlayer,
  smallestLevelForPlayers,
  upcomingPlayer,
  type GameAction,
  type GameState,
  type LevelId,
} from '..';

import { imageIds, secureRng } from './helpers';

const players = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` }));
/** Medium (4×4): pair k at positions 2k and 2k+1. */
const MEDIUM = imageIds(8).flatMap((id) => [id, id]);
const HARD = imageIds(12).flatMap((id) => [id, id]);

const flip = (index: number): GameAction => ({ type: 'flip', index });
const resolve: GameAction = { type: 'resolve' };
const leave = (player: number): GameAction => ({ type: 'leave', player });
const play = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state);
/** Current player misses (pair 0 card vs pair 1 card, both still down). */
function miss(g: GameState): GameState {
  const down = g.cards.filter((c) => c.status === 'down');
  const a = down[0]!;
  const b = down.find((c) => c.imageId !== a.imageId)!;
  return play(g, flip(a.index), flip(b.index), resolve);
}
/** Current player takes the pair at positions i, i+1. */
const take = (g: GameState, i: number) => play(g, flip(i), flip(i + 1), resolve);

describe('player-count rules', () => {
  it('allows 2–8 players with a shared maximum of 8', () => {
    expect(MAX_PLAYERS).toBe(8);
    expect(() =>
      createGame({ levelId: 'hard', layout: HARD, players: players(MAX_PLAYERS) }),
    ).not.toThrow();
    expect(() =>
      createGame({ levelId: 'hard', layout: HARD, players: players(MAX_PLAYERS + 1) }),
    ).toThrow(RangeError);
  });

  it('needs bigger boards for more players: 2 → any, 3–4 → 8 pairs, 5–8 → 12 pairs', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(minPairsForPlayers)).toEqual([0, 0, 8, 8, 12, 12, 12, 12]);
    const allowed = (n: number) =>
      LEVELS.filter((l) => isLevelAllowedForPlayers(l.id, n)).map((l) => l.id);
    expect(allowed(2)).toEqual(['tiny', 'easy', 'medium', 'tricky', 'hard', 'expert']);
    expect(allowed(3)).toEqual(['medium', 'tricky', 'hard', 'expert']);
    expect(allowed(4)).toEqual(['medium', 'tricky', 'hard', 'expert']);
    expect(allowed(5)).toEqual(['hard', 'expert']);
    expect(allowed(8)).toEqual(['hard', 'expert']);
    expect(allowed(9)).toEqual([]);
    expect(smallestLevelForPlayers(3).id).toBe('medium');
    expect(smallestLevelForPlayers(6).id).toBe('hard');
  });

  it('gives each level its largest group (online rooms take this many)', () => {
    const max = Object.fromEntries(LEVELS.map((l) => [l.id, maxPlayersForLevel(l.id)]));
    expect(max).toEqual({ tiny: 2, easy: 2, medium: 4, tricky: 4, hard: 8, expert: 8 });
  });

  it('rejects a board that is too small for the group', () => {
    const tiny = ['A', 'B', 'C', 'A', 'B', 'C'];
    expect(() => createGame({ levelId: 'tiny', layout: tiny, players: players(3) })).toThrow(
      /at least 8 pairs/,
    );
    expect(() => createGame({ levelId: 'medium', layout: MEDIUM, players: players(5) })).toThrow(
      /at least 12 pairs/,
    );
    expect(() =>
      createGame({ levelId: 'medium', layout: MEDIUM, players: players(4) }),
    ).not.toThrow();
  });
});

describe('turn order with many players', () => {
  it('passes the turn round the table on a miss, and keeps it on a match', () => {
    let g = createGame({
      levelId: 'medium',
      layout: MEDIUM,
      players: players(4),
      startingPlayer: 2,
    });
    const order: number[] = [g.currentPlayer];
    for (let i = 0; i < 5; i++) {
      g = miss(g);
      order.push(g.currentPlayer);
    }
    expect(order).toEqual([2, 3, 0, 1, 2, 3]);
    g = take(g, 0);
    expect(g.currentPlayer).toBe(3);
    expect(g.players[3]!.collected).toEqual(['img1']);
  });

  it('names the next player (the "Next" tag)', () => {
    let g = createGame({ levelId: 'medium', layout: MEDIUM, players: players(3) });
    expect(upcomingPlayer(g)).toBe(1);
    g = miss(g);
    expect(upcomingPlayer(g)).toBe(2);
    g = miss(g);
    expect(upcomingPlayer(g)).toBe(0);
  });

  it('a turn timeout passes to the next player', () => {
    const g = createGame({ levelId: 'hard', layout: HARD, players: players(6), startingPlayer: 5 });
    expect(gameReducer(g, { type: 'timeout' }).currentPlayer).toBe(0);
  });

  it('rotates the starter on every rematch', () => {
    const starters = [0, 1, 2, 3].map((s) =>
      rematchStartingPlayer(
        createGame({ levelId: 'medium', layout: MEDIUM, players: players(4), startingPlayer: s }),
      ),
    );
    expect(starters).toEqual([1, 2, 3, 0]);
  });
});

describe('players leaving (online)', () => {
  it('skips the turns of a player who left', () => {
    let g = createGame({ levelId: 'medium', layout: MEDIUM, players: players(4) });
    g = gameReducer(g, leave(1));
    expect(g.players[1]!.left).toBe(true);
    expect(g.currentPlayer).toBe(0);
    expect(upcomingPlayer(g)).toBe(2);
    g = miss(g);
    expect(g.currentPlayer).toBe(2);
    g = miss(g);
    g = miss(g);
    expect(g.currentPlayer).toBe(0);
  });

  it('when the current player leaves, their open cards flip back and the turn passes', () => {
    let g = createGame({ levelId: 'medium', layout: MEDIUM, players: players(3) });
    g = play(g, flip(0), flip(1)); // a match is pending…
    g = gameReducer(g, leave(0));
    expect(g.cards[0]!.status).toBe('down'); // …but is not collected
    expect(g.cards[1]!.status).toBe('down');
    expect(g.players[0]!.collected).toEqual([]);
    expect(g).toMatchObject({ currentPlayer: 1, phase: 'awaitingFirst', flipped: [] });
    expect(g.pendingResult).toBeNull();
  });

  it('when the game ends by leaving, any open card flips back', () => {
    let g = createGame({ levelId: 'medium', layout: MEDIUM, players: players(2) });
    g = play(g, flip(0), leave(1));
    expect(g).toMatchObject({ phase: 'finished', flipped: [], pendingResult: null });
    expect(g.cards[0]!.status).toBe('down');
  });

  it('ignores leaving twice, unknown players and finished games', () => {
    const g = gameReducer(
      createGame({ levelId: 'medium', layout: MEDIUM, players: players(3) }),
      leave(2),
    );
    expect(gameReducer(g, leave(2))).toBe(g);
    expect(gameReducer(g, leave(7))).toBe(g);
    const over = gameReducer(g, leave(1));
    expect(isFinished(over)).toBe(true);
    expect(gameReducer(over, leave(0))).toBe(over);
  });

  it('ends the game when only one player is left — they rank first', () => {
    let g = createGame({ levelId: 'medium', layout: MEDIUM, players: players(3) });
    g = take(g, 0);
    g = take(g, 2);
    g = miss(g);
    g = take(g, 4); // P1 has 2, P2 has 1, P3 none
    g = play(g, leave(0), leave(2));
    expect(g).toMatchObject({ phase: 'finished', endReason: 'abandoned' });
    expect(getRanking(g)).toEqual([
      { player: 1, rank: 1, score: 1, left: false },
      { player: 0, rank: 2, score: 2, left: true },
      { player: 2, rank: 3, score: 0, left: true },
    ]);
    expect(getOutcome(g)).toMatchObject({ winners: [1], isTie: false });
  });

  it('with two players, leaving hands the game to the other player (as before)', () => {
    const tiny = ['A', 'B', 'C', 'A', 'B', 'C'];
    const g = gameReducer(
      createGame({ levelId: 'tiny', layout: tiny, players: players(2) }),
      leave(0),
    );
    expect(g.phase).toBe('finished');
    expect(getOutcome(g).winners).toEqual([1]);
  });
});

describe('ranking', () => {
  it('ranks by pairs with shared places for ties (1, 1, 3, 4)', () => {
    let g = createGame({ levelId: 'medium', layout: MEDIUM, players: players(4) });
    g = take(g, 0); // P1: 1
    g = take(g, 2); // P1: 2
    g = miss(g);
    g = take(g, 4); // P2: 1
    g = take(g, 6); // P2: 2
    g = miss(g);
    g = take(g, 8); // P3: 1
    g = miss(g);
    g = miss(g); // P1 again
    g = take(g, 10);
    g = take(g, 12);
    g = take(g, 14); // P1: 5 — game over
    expect(isFinished(g)).toBe(true);
    expect(g.endReason).toBe('complete');
    expect(getRanking(g).map((s) => [s.player, s.rank, s.score])).toEqual([
      [0, 1, 5],
      [1, 2, 2],
      [2, 3, 1],
      [3, 4, 0],
    ]);
    const tie = createGame({ levelId: 'medium', layout: MEDIUM, players: players(3) });
    let t = take(take(tie, 0), 2);
    t = miss(t);
    t = take(take(t, 4), 6);
    t = miss(t);
    expect(getRanking(t).map((s) => [s.player, s.rank])).toEqual([
      [0, 1],
      [1, 1],
      [2, 3],
    ]);
    expect(getOutcome(t)).toMatchObject({ winners: [0, 1], isTie: true });
  });
});

describe('full games', () => {
  it('plays random 2–8 player games to the end on every allowed level', () => {
    const rng = secureRng();
    for (let n = 2; n <= MAX_PLAYERS; n++) {
      for (const level of LEVELS.filter((l) => isLevelAllowedForPlayers(l.id as LevelId, n))) {
        let g = createGame({
          levelId: level.id,
          layout: randomLayout(imageIds(24), level.pairs, rng),
          players: players(n),
          startingPlayer: rng.nextInt(n),
        });
        let guard = 0;
        while (!isFinished(g) && guard++ < 5000) {
          const down = g.cards.filter((c) => c.status === 'down');
          const a = down[rng.nextInt(down.length)]!;
          const rest = down.filter((c) => c.index !== a.index);
          const b = rest[rng.nextInt(rest.length)]!;
          const before = g.currentPlayer;
          g = play(g, flip(a.index), flip(b.index), resolve);
          const matched = a.imageId === b.imageId;
          expect(g.currentPlayer).toBe(matched || isFinished(g) ? before : (before + 1) % n);
        }
        expect(isFinished(g)).toBe(true);
        expect(g.players.reduce((sum, p) => sum + p.collected.length, 0)).toBe(level.pairs);
        expect(getRanking(g)[0]!.rank).toBe(1);
      }
    }
  });
});
