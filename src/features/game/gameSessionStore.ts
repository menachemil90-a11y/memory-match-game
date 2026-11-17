import { create } from 'zustand';

import type { Board } from '@/features/boards/types';
import type { PlayerProfile } from '@/features/players/playersStore';
import {
  createGame,
  gameReducer,
  rematchStartingPlayer,
  type GameAction,
  type GameState,
  type LevelId,
} from '@/game';

export type GameMode = 'solo' | 'local';

export interface GameConfig {
  mode: GameMode;
  board: Board;
  levelId: LevelId;
  players: PlayerProfile[];
  tabletop: boolean;
}

export interface GameSession {
  /** Unique per game; screens key their effects on it. */
  id: number;
  config: GameConfig;
  state: GameState;
  /** Solo timer: accumulated active play time (ms). */
  elapsedMs: number;
  /** When the timer last resumed (epoch ms), or null while paused. */
  runningSince: number | null;
}

export type Dealer = (config: GameConfig) => Promise<readonly string[]>;

interface SessionStore {
  session: GameSession | null;
  start: (config: GameConfig, deal: Dealer, startingPlayer?: number) => Promise<GameSession>;
  rematch: (deal: Dealer) => Promise<GameSession | null>;
  dispatch: (action: GameAction) => boolean;
  resumeTimer: (now?: number) => void;
  pauseTimer: (now?: number) => void;
  clear: () => void;
}

let nextId = 1;

export function sessionElapsed(session: GameSession, now: number = Date.now()): number {
  return session.elapsedMs + (session.runningSince === null ? 0 : now - session.runningSince);
}

export const useGameSession = create<SessionStore>()((set, get) => ({
  session: null,

  async start(config, deal, startingPlayer = 0) {
    const layout = await deal(config);
    const state = createGame({
      levelId: config.levelId,
      layout,
      players: config.players.map((p, i) => ({ id: `p${i + 1}`, name: p.name })),
      startingPlayer,
    });
    const session: GameSession = { id: nextId++, config, state, elapsedMs: 0, runningSince: null };
    set({ session });
    return session;
  },

  async rematch(deal) {
    const previous = get().session;
    if (!previous) return null;
    return get().start(previous.config, deal, rematchStartingPlayer(previous.state));
  },

  dispatch(action) {
    const session = get().session;
    if (!session) return false;
    const state = gameReducer(session.state, action);
    if (state === session.state) return false;
    let { elapsedMs, runningSince } = session;
    if (state.phase === 'finished' && runningSince !== null) {
      elapsedMs += Date.now() - runningSince;
      runningSince = null;
    }
    set({ session: { ...session, state, elapsedMs, runningSince } });
    return true;
  },

  resumeTimer(now = Date.now()) {
    const session = get().session;
    if (!session || session.runningSince !== null || session.state.phase === 'finished') return;
    set({ session: { ...session, runningSince: now } });
  },

  pauseTimer(now = Date.now()) {
    const session = get().session;
    if (!session || session.runningSince === null) return;
    set({
      session: {
        ...session,
        elapsedMs: session.elapsedMs + now - session.runningSince,
        runningSince: null,
      },
    });
  },

  clear: () => set({ session: null }),
}));
