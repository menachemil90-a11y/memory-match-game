import { getLevel } from './levels';
import type {
  CardState,
  GameAction,
  GameOutcome,
  GameState,
  LevelId,
  Layout,
  PlayerSetup,
  PlayerState,
} from './types';

export interface CreateGameOptions {
  levelId: LevelId;
  /** Image IDs by grid position — from `dealUniqueLayout`. */
  layout: Layout;
  players: readonly PlayerSetup[];
  /** Index of the player who flips first (defaults to 0). */
  startingPlayer?: number;
}

export function createGame({
  levelId,
  layout,
  players,
  startingPlayer = 0,
}: CreateGameOptions): GameState {
  const level = getLevel(levelId);
  const cardCount = level.cols * level.rows;
  if (layout.length !== cardCount) {
    throw new Error(`Layout has ${layout.length} cards; level ${levelId} needs ${cardCount}`);
  }
  const counts = new Map<string, number>();
  for (const id of layout) counts.set(id, (counts.get(id) ?? 0) + 1);
  if (counts.size !== level.pairs || [...counts.values()].some((c) => c !== 2)) {
    throw new Error('Layout must contain every image exactly twice');
  }
  if (players.length < 1) throw new Error('At least one player is required');
  if (!Number.isInteger(startingPlayer) || startingPlayer < 0 || startingPlayer >= players.length) {
    throw new RangeError(`Invalid starting player: ${startingPlayer}`);
  }

  return {
    levelId,
    cols: level.cols,
    rows: level.rows,
    cards: layout.map((imageId, index): CardState => ({
      index,
      imageId,
      status: 'down',
      matchedBy: null,
    })),
    players: players.map((p): PlayerState => ({
      id: p.id,
      name: p.name,
      collected: [],
      moves: 0,
      streak: 0,
      bestStreak: 0,
    })),
    currentPlayer: startingPlayer,
    startingPlayer,
    phase: 'awaitingFirst',
    flipped: [],
    pendingResult: null,
    moves: 0,
    pairsTotal: level.pairs,
    pairsFound: 0,
    version: 0,
  };
}

function updateCards(
  cards: readonly CardState[],
  indices: readonly number[],
  patch: Partial<Pick<CardState, 'status' | 'matchedBy'>>,
): CardState[] {
  return cards.map((card) => (indices.includes(card.index) ? { ...card, ...patch } : card));
}

function updatePlayer(
  players: readonly PlayerState[],
  index: number,
  update: (p: PlayerState) => PlayerState,
): PlayerState[] {
  return players.map((p, i) => (i === index ? update(p) : p));
}

function nextPlayer(state: GameState): number {
  return (state.currentPlayer + 1) % state.players.length;
}

function flip(state: GameState, index: number, player: number | undefined): GameState {
  if (state.phase !== 'awaitingFirst' && state.phase !== 'awaitingSecond') return state;
  if (player !== undefined && player !== state.currentPlayer) return state;
  const card = state.cards[index];
  if (!Number.isInteger(index) || !card || card.status !== 'down') return state;

  if (state.phase === 'awaitingFirst') {
    return {
      ...state,
      cards: updateCards(state.cards, [index], { status: 'up' }),
      flipped: [index],
      phase: 'awaitingSecond',
      version: state.version + 1,
    };
  }

  const firstIndex = state.flipped[0]!;
  const first = state.cards[firstIndex]!;
  const isMatch = first.imageId === card.imageId;
  return {
    ...state,
    cards: updateCards(state.cards, [index], { status: 'up' }),
    flipped: [firstIndex, index],
    phase: 'resolving',
    pendingResult: isMatch ? 'match' : 'mismatch',
    moves: state.moves + 1,
    players: updatePlayer(state.players, state.currentPlayer, (p) => ({
      ...p,
      moves: p.moves + 1,
    })),
    version: state.version + 1,
  };
}

function resolve(state: GameState): GameState {
  if (state.phase !== 'resolving') return state;
  const [a, b] = state.flipped as [number, number];
  const current = state.currentPlayer;

  if (state.pendingResult === 'match') {
    const imageId = state.cards[a]!.imageId;
    const pairsFound = state.pairsFound + 1;
    const finished = pairsFound === state.pairsTotal;
    return {
      ...state,
      cards: updateCards(state.cards, [a, b], { status: 'matched', matchedBy: current }),
      players: updatePlayer(state.players, current, (p) => {
        const streak = p.streak + 1;
        return {
          ...p,
          collected: [...p.collected, imageId],
          streak,
          bestStreak: Math.max(p.bestStreak, streak),
        };
      }),
      flipped: [],
      pendingResult: null,
      pairsFound,
      // A match keeps the turn with the same player.
      phase: finished ? 'finished' : 'awaitingFirst',
      version: state.version + 1,
    };
  }

  return {
    ...state,
    cards: updateCards(state.cards, [a, b], { status: 'down' }),
    players: updatePlayer(state.players, current, (p) => ({ ...p, streak: 0 })),
    flipped: [],
    pendingResult: null,
    currentPlayer: nextPlayer(state),
    phase: 'awaitingFirst',
    version: state.version + 1,
  };
}

/** The turn timer ran out: flip any open card back and pass the turn. */
function timeout(state: GameState): GameState {
  if (state.phase === 'finished') return state;
  if (state.phase === 'resolving') return resolve(state);
  return {
    ...state,
    cards: updateCards(state.cards, state.flipped, { status: 'down' }),
    players: updatePlayer(state.players, state.currentPlayer, (p) => ({ ...p, streak: 0 })),
    flipped: [],
    currentPlayer: nextPlayer(state),
    phase: 'awaitingFirst',
    version: state.version + 1,
  };
}

/**
 * The single source of truth for the rules. Pure: returns a new state, or the
 * very same object when the action is not allowed (so callers can detect no-ops
 * with `===`).
 */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'flip':
      return flip(state, action.index, action.player);
    case 'resolve':
      return resolve(state);
    case 'timeout':
      return timeout(state);
  }
}

/** Whether a tap on `index` would be accepted right now. */
export function canFlip(state: GameState, index: number, player?: number): boolean {
  return flip(state, index, player) !== state;
}

export function isFinished(state: GameState): boolean {
  return state.phase === 'finished';
}

export function getOutcome(state: GameState): GameOutcome {
  const scores = state.players.map((p) => p.collected.length);
  const best = Math.max(...scores);
  const winners = scores.flatMap((s, i) => (s === best ? [i] : []));
  return { winners, scores, isTie: winners.length > 1 };
}

/** Starting player for a rematch: the other player starts. */
export function rematchStartingPlayer(previous: GameState): number {
  return (previous.startingPlayer + 1) % previous.players.length;
}

/** Card indices visible to an observer: face-up/matched cards only (used by the server). */
export function visibleCards(
  state: GameState,
): ({ index: number; imageId: string | null } & Pick<CardState, 'status' | 'matchedBy'>)[] {
  return state.cards.map((c) => ({
    index: c.index,
    status: c.status,
    matchedBy: c.matchedBy,
    imageId: c.status === 'down' ? null : c.imageId,
  }));
}
