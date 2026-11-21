/**
 * Core types for the pure game engine. Nothing in `src/game` may import
 * React, React Native or Expo — the same code runs in Jest, in the app and on
 * the server.
 */

export type LevelId = 'tiny' | 'easy' | 'medium' | 'tricky' | 'hard' | 'expert';

export interface LevelDefinition {
  id: LevelId;
  pairs: number;
  /** Grid columns (portrait). */
  cols: number;
  /** Grid rows (portrait). */
  rows: number;
}

/** An image identifier. Two cards match when their imageIds are equal. */
export type ImageId = string;

/** The ordered list of image IDs by grid position. */
export type Layout = readonly ImageId[];

export type CardStatus = 'down' | 'up' | 'matched';

export interface CardState {
  /** Grid position (0-based, row-major). Never changes — the grid never reflows. */
  readonly index: number;
  readonly imageId: ImageId;
  readonly status: CardStatus;
  /** Player index that collected this card (only when `status === 'matched'`). */
  readonly matchedBy: number | null;
}

export interface PlayerSetup {
  id: string;
  name: string;
}

export interface PlayerState extends PlayerSetup {
  /** Image IDs of the pairs this player has collected, in collection order. */
  readonly collected: readonly ImageId[];
  /** Number of turns (pair attempts) this player has taken. */
  readonly moves: number;
  /** Longest run of consecutive matches. */
  readonly bestStreak: number;
  /** Current run of consecutive matches in this turn. */
  readonly streak: number;
  /**
   * Left the game (online: left or lost connection). Their turns are skipped;
   * the pairs they collected stay theirs, and they rank after everyone who stayed.
   */
  readonly left: boolean;
}

/**
 * - `awaitingFirst`: current player may flip any face-down card.
 * - `awaitingSecond`: one card is face up; the player may flip a second card.
 * - `resolving`: two cards are face up and the result is known; input is
 *   locked until a `resolve` (or `timeout`) action. The UI dispatches
 *   `resolve` after its match/mismatch animation (or when the board is tapped
 *   to skip the mismatch delay).
 * - `finished`: all pairs collected, or only one player is still in the game.
 */
export type GamePhase = 'awaitingFirst' | 'awaitingSecond' | 'resolving' | 'finished';

export type TurnResult = 'match' | 'mismatch';

export interface GameState {
  readonly levelId: LevelId;
  readonly cols: number;
  readonly rows: number;
  readonly cards: readonly CardState[];
  readonly players: readonly PlayerState[];
  readonly currentPlayer: number;
  readonly startingPlayer: number;
  readonly phase: GamePhase;
  /** Indices of face-up, unresolved cards (0, 1 or 2 entries). */
  readonly flipped: readonly number[];
  /** Result of the pending pair while `phase === 'resolving'`. */
  readonly pendingResult: TurnResult | null;
  /** Total pair attempts by all players. */
  readonly moves: number;
  readonly pairsTotal: number;
  readonly pairsFound: number;
  /** Why the game ended: every pair found, or everyone else left. */
  readonly endReason: 'complete' | 'abandoned' | null;
  /** Increments on every accepted action; useful for syncing/optimistic locking. */
  readonly version: number;
}

export type GameAction =
  | { type: 'flip'; index: number; player?: number }
  | { type: 'resolve' }
  | { type: 'timeout' }
  /** A player leaves for good (online). See `PlayerState.left`. */
  | { type: 'leave'; player: number };

export interface GameOutcome {
  /** Player indices ranked first (more than one means a tie). */
  winners: number[];
  isTie: boolean;
  /** Pair counts by player index. */
  scores: number[];
}

/** One line of the final ranking. */
export interface Standing {
  player: number;
  /** 1 = first. Equal scores share a place (1, 1, 3, …). */
  rank: number;
  score: number;
  left: boolean;
}
