/* eslint-disable import/first -- modules must load after jest.mock() */
/**
 * 3–8 players on one phone, through the real screens and stores: the setup
 * (add/remove players, colors and avatars, the remembered group), the level
 * picker (boards too small for the group are disabled and explained), the
 * game's player strip and turn banner, and the ranking on the results screen.
 */
import { createTestDb } from '@/lib/db/__tests__/nodeSqliteDb';
import { migrate } from '@/lib/db/migrations';

import type * as ReactModule from 'react';

const mockParams: Record<string, string | undefined> = {};
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  dismissTo: jest.fn(),
  canGoBack: jest.fn(() => true),
};
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof ReactModule>('react');
  return {
    get router() {
      return mockRouter;
    },
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    Redirect: () => null,
  };
});
jest.mock('@/lib/kvStorage', () => {
  const data = new Map<string, string>();
  return {
    kvStateStorage: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    },
  };
});
// Deals pair k at positions 2k and 2k+1 (the real dealer keeps its history in SQLite).
jest.mock('@/features/game/dealer', () => ({
  deviceDealer: async (config: { board: { images: { id: string }[] }; levelId: string }) => {
    const pairs = { tiny: 3, easy: 6, medium: 8, tricky: 10, hard: 12, expert: 18 }[
      config.levelId
    ]!;
    return config.board.images.slice(0, pairs).flatMap((i) => [i.id, i.id]);
  },
}));
// Skia's Jest mock has no Paint; the celebration is not what this test is about.
jest.mock('@/ui/components/Confetti', () => ({ Confetti: () => null }));
const mockDb = createTestDb();
jest.mock('@/lib/db', () => ({ getDb: async () => mockDb }));

import { act, fireEvent, screen } from '@testing-library/react-native';

import GameScreen from '@/app/game';
import LevelPickerScreen from '@/app/levels';
import ResultsScreen from '@/app/results';
import PlayerSetupScreen from '@/app/setup';
import { getBuiltinBoard } from '@/features/boards/builtin';
import { stripOrder } from '@/features/game/components/PlayerStrip';
import { useGameSession, type Dealer } from '@/features/game/gameSessionStore';
import {
  DEFAULT_LOCAL_PLAYERS,
  normalizeGroup,
  usePlayersStore,
  type PlayerProfile,
} from '@/features/players/playersStore';
import { initI18n } from '@/lib/i18n';
import { renderScreen } from '@/test-utils/renderScreen';
import { colors } from '@/ui/theme';

/** Sentences that start with a name get an invisible left-to-right mark first. */
const LRM = '\u200E';
const FSI = '⁨';
const PDI = '⁩';

const setParams = (params: Record<string, string | undefined>) => {
  for (const k of Object.keys(mockParams)) delete mockParams[k];
  Object.assign(mockParams, params);
};
const settle = () => act(() => new Promise<void>((r) => setTimeout(r, 20)));
const button = (name: string | RegExp) => screen.getByRole('button', { name });

const group = (n: number): PlayerProfile[] =>
  normalizeGroup(
    Array.from({ length: n }, (_, i) => ({
      name: ['Noa', 'Avi', 'Dana', 'Grandpa', 'Eli', 'Mia', 'Tom', 'Yael'][i]!,
      color: colors.players[i]!.id,
      avatar: 'fox',
    })),
  );

/** Medium deal with pair k at 2k and 2k+1 (animals board image ids). */
const mediumDealer: Dealer = async (config) => {
  const ids = config.board.images.slice(0, 8).map((i) => i.id);
  return ids.flatMap((id) => [id, id]);
};

let consoleErrors: jest.SpyInstance;

beforeAll(async () => {
  initI18n();
  await migrate(mockDb);
});

afterEach(() => {
  // No screen may log an error.
  expect(consoleErrors.mock.calls).toEqual([]);
  consoleErrors.mockRestore();
});

beforeEach(() => {
  jest.clearAllMocks();
  consoleErrors = jest.spyOn(console, 'error');
  usePlayersStore.setState({ local: DEFAULT_LOCAL_PLAYERS, tabletop: false });
  useGameSession.getState().clear();
});

describe('the remembered group', () => {
  it('cleans up whatever was stored: 2–8 players, every color once', () => {
    const fox = 'fox' as const;
    // Stored by older versions: exactly two players.
    expect(normalizeGroup(DEFAULT_LOCAL_PLAYERS)).toEqual(DEFAULT_LOCAL_PLAYERS);
    expect(normalizeGroup([])).toHaveLength(2);
    const clash = normalizeGroup([
      { name: ' Noa ', color: 'coral', avatar: fox },
      { name: 'Avi', color: 'coral', avatar: fox },
      { name: 'Dana', color: 'nope' as PlayerProfile['color'], avatar: fox },
    ]);
    expect(clash.map((p) => p.name)).toEqual(['Noa', 'Avi', 'Dana']);
    expect(new Set(clash.map((p) => p.color)).size).toBe(3);
    expect(normalizeGroup(group(8).concat(group(2)))).toHaveLength(8);
    expect(colors.players).toHaveLength(8);
  });
});

describe('setup', () => {
  it('adds and removes players, keeps colors and avatars apart, and remembers the group', async () => {
    setParams({});
    await renderScreen(<PlayerSetupScreen />);
    expect(screen.getByText('2 players')).toBeTruthy();
    expect(screen.getByText('Tabletop mode')).toBeTruthy();

    await fireEvent.press(button('Add a player'));
    await fireEvent.press(button('Add a player'));
    expect(screen.getByText('4 players')).toBeTruthy();
    // Tabletop mode is for two players facing each other.
    expect(screen.queryByText('Tabletop mode')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Player 3 Name'), 'Dana');

    // Each color belongs to one player: Player 3 can't pick Player 1's coral.
    const coralChoices = screen.getAllByRole('radio', { name: 'Coral color' });
    expect(coralChoices[2]).toBeDisabled();

    await fireEvent.press(button('Remove Player 2'));
    expect(screen.getByText('3 players')).toBeTruthy();
    expect(screen.getByLabelText('Player 2 Name').props.value).toBe('Dana');

    await fireEvent.press(button('Choose a board'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/boards',
      params: { mode: 'local' },
    });
    const saved = usePlayersStore.getState().local;
    expect(saved.map((p) => p.name)).toEqual(['', 'Dana', '']);
    expect(new Set(saved.map((p) => p.color)).size).toBe(3);
    expect(new Set(saved.map((p) => p.avatar)).size).toBe(3);
  });

  it('stops at 8 players', async () => {
    usePlayersStore.setState({ local: group(7) });
    setParams({});
    await renderScreen(<PlayerSetupScreen />);
    await fireEvent.press(button('Add a player'));
    expect(screen.getByText('8 players')).toBeTruthy();
    expect(button('Add a player')).toBeDisabled();
    expect(screen.getByText('8 players — the most that can play.')).toBeTruthy();
  });

  it('opened for a small level, the group is capped at what that level allows', async () => {
    usePlayersStore.setState({ local: group(4) });
    setParams({ boardId: 'animals', levelId: 'easy' });
    await renderScreen(<PlayerSetupScreen />);
    expect(screen.getByText('2 players')).toBeTruthy();
    expect(button('Add a player')).toBeDisabled();
    expect(
      screen.getByText('Easy is for up to 2 players. Pick a bigger level for more.'),
    ).toBeTruthy();
    expect(button("Let's play!")).toBeEnabled();
  });
});

describe('level picker for a group', () => {
  it('disables boards that are too small for the group and explains why', async () => {
    usePlayersStore.setState({ local: group(4) });
    setParams({ mode: 'local', boardId: 'animals' });
    await renderScreen(<LevelPickerScreen />);
    expect(screen.getByText('4 players')).toBeTruthy();
    expect(button('Tiny, for up to 2 players.')).toBeTruthy();
    expect(button('Easy, for up to 2 players.')).toBeTruthy();

    await fireEvent.press(button('Tiny, for up to 2 players.'));
    expect(screen.getByText('Tiny is too small for 4 players')).toBeTruthy();
    expect(
      screen.getByText(
        'With 4 players, choose Medium or a bigger board, so everyone gets enough turns.',
      ),
    ).toBeTruthy();
    // The dialog's button (the screen has its own "Change players" button too).
    await fireEvent.press(screen.getAllByRole('button', { name: 'Change players' }).at(-1)!);
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/setup');
    expect(useGameSession.getState().session).toBeNull();

    await fireEvent.press(button(/^Medium, 8 pairs/));
    await settle();
    expect(mockRouter.push).toHaveBeenCalledWith('/game');
    const config = useGameSession.getState().session!.config;
    expect(config.players).toHaveLength(4);
    expect(config.tabletop).toBe(false);
  });

  it('with 5 players, Hard is the smallest level', async () => {
    usePlayersStore.setState({ local: group(5) });
    setParams({ mode: 'local', boardId: 'animals' });
    await renderScreen(<LevelPickerScreen />);
    expect(button('Medium, for up to 4 players.')).toBeTruthy();
    expect(button('Tricky, for up to 4 players.')).toBeTruthy();
    expect(button(/^Hard, 12 pairs/)).toBeTruthy();
  });
});

describe('a 4-player game', () => {
  async function startFour() {
    await useGameSession.getState().start(
      {
        mode: 'local',
        board: getBuiltinBoard('animals')!,
        levelId: 'medium',
        players: group(4),
        tabletop: false,
      },
      mediumDealer,
    );
  }
  const dispatch = (
    ...actions: Parameters<ReturnType<typeof useGameSession.getState>['dispatch']>[0][]
  ) =>
    act(() => {
      for (const a of actions) useGameSession.getState().dispatch(a);
    });

  it('shows everyone in the strip: current player, the next one, then the rest', async () => {
    await startFour();
    await renderScreen(<GameScreen />);
    expect(screen.getByLabelText(`Noa, 0 pairs, playing now`)).toBeTruthy();
    expect(screen.getByLabelText(`${LRM}${FSI}Avi${PDI}, 0 pairs, next`)).toBeTruthy();
    expect(screen.getByLabelText(`${LRM}${FSI}Dana${PDI}, 0 pairs`)).toBeTruthy();
    expect(screen.getByLabelText(`${LRM}${FSI}Grandpa${PDI}, 0 pairs`)).toBeTruthy();
    // No two-player panels at the bottom.
    expect(screen.getAllByLabelText(/playing now/)).toHaveLength(1);

    // Noa finds a pair (keeps the turn), then misses: Avi's turn, Dana is next.
    await dispatch(
      { type: 'flip', index: 0 },
      { type: 'flip', index: 1 },
      { type: 'resolve' },
      { type: 'flip', index: 2 },
      { type: 'flip', index: 4 },
      { type: 'resolve' },
    );
    expect(screen.getByLabelText(`Avi, 0 pairs, playing now`)).toBeTruthy();
    expect(screen.getByLabelText(`${LRM}${FSI}Dana${PDI}, 0 pairs, next`)).toBeTruthy();
    expect(screen.getByLabelText(`${LRM}${FSI}Noa${PDI}, 1 pair`)).toBeTruthy();
    // The big "pass the phone" banner names the new player.
    expect(screen.getByText(new RegExp(`${FSI}Avi${PDI}'s turn 👉`))).toBeTruthy();
    screen.unmount();
  });

  it('ranks everyone at the end, with a rematch for the whole group', async () => {
    await startFour();
    // Noa 2, miss; Avi 3, miss; Dana 1, miss; Grandpa misses; Noa 2 more.
    const take = (i: number) => [
      { type: 'flip' as const, index: i },
      { type: 'flip' as const, index: i + 1 },
      { type: 'resolve' as const },
    ];
    const missPair = (a: number, b: number) => [
      { type: 'flip' as const, index: a },
      { type: 'flip' as const, index: b },
      { type: 'resolve' as const },
    ];
    await dispatch(
      ...take(0),
      ...take(2),
      ...missPair(12, 14),
      ...take(4),
      ...take(6),
      ...take(8),
      ...missPair(12, 14),
      ...take(10),
      ...missPair(12, 14),
      ...missPair(12, 14),
      ...take(12),
      ...take(14),
    );
    const session = useGameSession.getState().session!;
    expect(session.state.phase).toBe('finished');
    await renderScreen(<ResultsScreen />);
    expect(screen.getByText(`${FSI}Noa${PDI} wins!`, { exact: false })).toBeTruthy();
    expect(screen.getByLabelText(`1st place: ${FSI}Noa${PDI}, 4 pairs`)).toBeTruthy();
    expect(screen.getByLabelText(`2nd place: ${FSI}Avi${PDI}, 3 pairs`)).toBeTruthy();
    expect(screen.getByLabelText(`3rd place: ${FSI}Dana${PDI}, 1 pair`)).toBeTruthy();
    expect(screen.getByLabelText(`4th place: ${FSI}Grandpa${PDI}, 0 pairs`)).toBeTruthy();
    expect(button('Play again')).toBeEnabled();
    screen.unmount();
  });

  it('two players keep the classic layout: a panel each, no strip, the usual banner', async () => {
    const images = getBuiltinBoard('animals')!
      .images.slice(0, 3)
      .map((i) => i.id);
    await useGameSession.getState().start(
      {
        mode: 'local',
        board: getBuiltinBoard('animals')!,
        levelId: 'tiny',
        players: group(2),
        tabletop: false,
      },
      async () => [...images, ...images],
    );
    await renderScreen(<GameScreen />);
    expect(screen.getByLabelText('Noa, 0 pairs, playing now')).toBeTruthy();
    expect(screen.getByLabelText('Avi, 0 pairs')).toBeTruthy();
    expect(screen.queryByText('Next')).toBeNull();
    expect(screen.getByText(new RegExp(`${FSI}Noa${PDI}'s turn!`))).toBeTruthy();
    screen.unmount();
  });
});

describe('strip order', () => {
  it('starts with the current player, keeps seating order, and puts players who left last', () => {
    const p = (index: number, left = false) => ({
      index,
      profile: group(5)[index]!,
      displayName: `P${index}`,
      collected: [],
      left,
    });
    const order = stripOrder([p(0), p(1, true), p(2), p(3), p(4)], 3).map((x) => x.index);
    expect(order).toEqual([3, 4, 0, 2, 1]);
    expect(stripOrder([p(0), p(1)], null).map((x) => x.index)).toEqual([0, 1]);
  });
});
