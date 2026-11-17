/** @jest-environment node */
import {
  canFlip,
  createGame,
  gameReducer,
  getOutcome,
  isFinished,
  randomLayout,
  rematchStartingPlayer,
  visibleCards,
  type GameAction,
  type GameState,
} from '..';

import { imageIds, secureRng } from './helpers';

// Tiny level (2×3). Pairs: A at 0/3, B at 1/4, C at 2/5.
const TINY = ['A', 'B', 'C', 'A', 'B', 'C'];
const TWO = [
  { id: 'p1', name: 'Noa' },
  { id: 'p2', name: 'Avi' },
];

function play(state: GameState, ...actions: GameAction[]): GameState {
  return actions.reduce(gameReducer, state);
}
const flip = (index: number, player?: number): GameAction => ({ type: 'flip', index, player });
const resolve: GameAction = { type: 'resolve' };

function newTiny(startingPlayer = 0) {
  return createGame({ levelId: 'tiny', layout: TINY, players: TWO, startingPlayer });
}

describe('createGame', () => {
  it('starts with every card face down in a grid', () => {
    const g = newTiny();
    expect(g.cards).toHaveLength(6);
    expect(g.cards.every((c) => c.status === 'down' && c.matchedBy === null)).toBe(true);
    expect(g.cards.map((c) => c.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(g).toMatchObject({
      cols: 2,
      rows: 3,
      phase: 'awaitingFirst',
      currentPlayer: 0,
      pairsTotal: 3,
      pairsFound: 0,
      moves: 0,
      version: 0,
    });
  });

  it('honours the starting player', () => {
    expect(newTiny(1).currentPlayer).toBe(1);
  });

  it('rejects invalid setups', () => {
    expect(() => createGame({ levelId: 'tiny', layout: TINY.slice(1), players: TWO })).toThrow();
    expect(() =>
      createGame({ levelId: 'tiny', layout: ['A', 'A', 'A', 'A', 'B', 'B'], players: TWO }),
    ).toThrow('exactly twice');
    expect(() => createGame({ levelId: 'tiny', layout: TINY, players: [] })).toThrow();
    expect(() =>
      createGame({ levelId: 'tiny', layout: TINY, players: TWO, startingPlayer: 2 }),
    ).toThrow(RangeError);
  });
});

describe('flipping', () => {
  it('flips the first card face up', () => {
    const g = play(newTiny(), flip(0));
    expect(g.cards[0]!.status).toBe('up');
    expect(g.flipped).toEqual([0]);
    expect(g.phase).toBe('awaitingSecond');
    expect(g.version).toBe(1);
  });

  it('ignores a tap on the already-open card', () => {
    const g = play(newTiny(), flip(0));
    expect(gameReducer(g, flip(0))).toBe(g);
    expect(canFlip(g, 0)).toBe(false);
  });

  it('locks input while two cards are open (a third card does nothing)', () => {
    const g = play(newTiny(), flip(0), flip(1));
    expect(g.phase).toBe('resolving');
    expect(gameReducer(g, flip(2))).toBe(g);
    expect(canFlip(g, 2)).toBe(false);
  });

  it('ignores out-of-range and non-integer indices', () => {
    const g = newTiny();
    expect(gameReducer(g, flip(-1))).toBe(g);
    expect(gameReducer(g, flip(6))).toBe(g);
    expect(gameReducer(g, flip(1.5))).toBe(g);
  });

  it('ignores flips from the player whose turn it is not', () => {
    const g = newTiny();
    expect(gameReducer(g, flip(0, 1))).toBe(g);
    expect(gameReducer(g, flip(0, 0))).not.toBe(g);
  });
});

describe('match', () => {
  it('collects the pair, leaves gaps and keeps the turn', () => {
    const resolving = play(newTiny(), flip(0), flip(3));
    expect(resolving.pendingResult).toBe('match');
    expect(resolving.moves).toBe(1);

    const g = gameReducer(resolving, resolve);
    expect(g.cards[0]).toMatchObject({ status: 'matched', matchedBy: 0 });
    expect(g.cards[3]).toMatchObject({ status: 'matched', matchedBy: 0 });
    // The grid never reflows: same length, same positions.
    expect(g.cards).toHaveLength(6);
    expect(g.cards.map((c) => c.imageId)).toEqual(TINY);
    expect(g.players[0]!.collected).toEqual(['A']);
    expect(g.currentPlayer).toBe(0);
    expect(g.phase).toBe('awaitingFirst');
    expect(g.pairsFound).toBe(1);
  });

  it('matched cards cannot be flipped again', () => {
    const g = play(newTiny(), flip(0), flip(3), resolve);
    expect(gameReducer(g, flip(0))).toBe(g);
    expect(gameReducer(g, flip(3))).toBe(g);
  });

  it('lets the same player keep going until they miss', () => {
    const g = play(newTiny(), flip(0), flip(3), resolve, flip(1), flip(4), resolve);
    expect(g.currentPlayer).toBe(0);
    expect(g.players[0]!.collected).toEqual(['A', 'B']);
    expect(g.players[0]!.streak).toBe(2);
    expect(g.players[0]!.bestStreak).toBe(2);
  });
});

describe('mismatch', () => {
  it('keeps both cards visible until resolved, then flips back and passes the turn', () => {
    const resolving = play(newTiny(), flip(0), flip(1));
    expect(resolving.pendingResult).toBe('mismatch');
    expect(resolving.cards[0]!.status).toBe('up');
    expect(resolving.cards[1]!.status).toBe('up');

    const g = gameReducer(resolving, resolve);
    expect(g.cards[0]!.status).toBe('down');
    expect(g.cards[1]!.status).toBe('down');
    expect(g.currentPlayer).toBe(1);
    expect(g.phase).toBe('awaitingFirst');
    expect(g.players[0]!.moves).toBe(1);
    expect(g.players[0]!.streak).toBe(0);
  });

  it('resets the streak but keeps the best streak', () => {
    const g = play(newTiny(), flip(0), flip(3), resolve, flip(1), flip(2), resolve);
    expect(g.players[0]!.streak).toBe(0);
    expect(g.players[0]!.bestStreak).toBe(1);
  });

  it('wraps the turn back to the first player', () => {
    const g = play(newTiny(), flip(0), flip(1), resolve, flip(0), flip(1), resolve);
    expect(g.currentPlayer).toBe(0);
  });

  it('resolve is a no-op when nothing is pending', () => {
    const g = newTiny();
    expect(gameReducer(g, resolve)).toBe(g);
    const one = play(g, flip(0));
    expect(gameReducer(one, resolve)).toBe(one);
  });
});

describe('end of game', () => {
  it('finishes when all pairs are collected and declares the winner', () => {
    // P0: A, miss → P1: B, C
    const g = play(
      newTiny(),
      flip(0),
      flip(3),
      resolve,
      flip(1),
      flip(2),
      resolve,
      flip(1),
      flip(4),
      resolve,
      flip(2),
      flip(5),
      resolve,
    );
    expect(isFinished(g)).toBe(true);
    expect(g.phase).toBe('finished');
    expect(getOutcome(g)).toEqual({ winners: [1], scores: [1, 2], isTie: false });
    expect(gameReducer(g, flip(0))).toBe(g);
    expect(gameReducer(g, { type: 'timeout' })).toBe(g);
  });

  it('handles ties', () => {
    const layout = imageIds(6).flatMap((id) => [id, id]); // easy, adjacent pairs
    let g = createGame({ levelId: 'easy', layout, players: TWO });
    // P0 takes 3 pairs, misses; P1 takes 3 pairs.
    for (const i of [0, 2, 4]) g = play(g, flip(i), flip(i + 1), resolve);
    g = play(g, flip(6), flip(8), resolve);
    for (const i of [6, 8, 10]) g = play(g, flip(i), flip(i + 1), resolve);
    expect(isFinished(g)).toBe(true);
    expect(getOutcome(g)).toEqual({ winners: [0, 1], scores: [3, 3], isTie: true });
  });

  it('plays a full solo game on every level with random layouts', () => {
    const rng = secureRng();
    for (const levelId of ['tiny', 'easy', 'medium', 'tricky', 'hard', 'expert'] as const) {
      const pairs = { tiny: 3, easy: 6, medium: 8, tricky: 10, hard: 12, expert: 18 }[levelId];
      const layout = randomLayout(imageIds(30), pairs, rng);
      let g = createGame({ levelId, layout, players: [{ id: 'solo', name: 'Me' }] });
      // A "perfect memory" bot: remembers every revealed card and completes known pairs.
      const seen = new Map<number, string>();
      let guard = 0;
      while (!isFinished(g) && guard++ < 1000) {
        const down = g.cards.filter((c) => c.status === 'down');
        const unknown = down.filter((c) => !seen.has(c.index));
        const first = (unknown[0] ?? down[0])!;
        g = gameReducer(g, flip(first.index));
        seen.set(first.index, first.imageId);
        const partner = down.find(
          (c) => c.index !== first.index && seen.get(c.index) === first.imageId,
        );
        const second = partner ?? down.find((c) => c.index !== first.index && !seen.has(c.index))!;
        g = gameReducer(g, flip(second.index));
        seen.set(second.index, second.imageId);
        g = gameReducer(g, resolve);
        expect(g.currentPlayer).toBe(0);
      }
      expect(isFinished(g)).toBe(true);
      expect(g.players[0]!.collected).toHaveLength(pairs);
      expect(g.cards.every((c) => c.status === 'matched')).toBe(true);
      expect(g.moves).toBeGreaterThanOrEqual(pairs);
    }
  });
});

describe('turn timer', () => {
  it('passes the turn when no card is open', () => {
    const g = gameReducer(newTiny(), { type: 'timeout' });
    expect(g.currentPlayer).toBe(1);
    expect(g.phase).toBe('awaitingFirst');
  });

  it('flips back a single open card and passes the turn', () => {
    const g = play(newTiny(), flip(0), { type: 'timeout' });
    expect(g.cards[0]!.status).toBe('down');
    expect(g.flipped).toEqual([]);
    expect(g.currentPlayer).toBe(1);
  });

  it('resolves a pending pair instead of double-passing', () => {
    const mismatch = play(newTiny(), flip(0), flip(1), { type: 'timeout' });
    expect(mismatch.currentPlayer).toBe(1);
    const match = play(newTiny(), flip(0), flip(3), { type: 'timeout' });
    expect(match.currentPlayer).toBe(0);
    expect(match.pairsFound).toBe(1);
  });
});

describe('rematch and visibility', () => {
  it('alternates the starting player on rematch', () => {
    expect(rematchStartingPlayer(newTiny(0))).toBe(1);
    expect(rematchStartingPlayer(newTiny(1))).toBe(0);
  });

  it('never reveals face-down images', () => {
    const g = play(newTiny(), flip(0), flip(3), resolve, flip(1));
    const visible = visibleCards(g);
    expect(visible.map((c) => c.imageId)).toEqual(['A', 'B', null, 'A', null, null]);
  });

  it('does not mutate previous states', () => {
    const g0 = newTiny();
    const snapshot = JSON.stringify(g0);
    play(g0, flip(0), flip(3), resolve, flip(1), flip(2), resolve);
    expect(JSON.stringify(g0)).toBe(snapshot);
  });
});
