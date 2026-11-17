/** @jest-environment node */
import { BUILTIN_BOARDS } from '@/features/boards/builtin';

import { sessionElapsed, useGameSession, type GameConfig } from '../gameSessionStore';

jest.mock('@/features/boards/builtin/generated', () => ({
  CARD_BACK_IDS: ['grape-stars'],
  CARD_BACK_SOURCES: { 'grape-stars': 1 },
  AVATAR_SOURCES: { fox: 1 },
  BUILTIN_BOARD_DATA: [
    {
      id: 'animals',
      cardBack: 'grape-stars',
      accent: '#000000',
      images: ['a', 'b', 'c', 'd'].map((key) => ({
        key,
        label: key,
        background: '#FFFFFF',
        source: 1,
      })),
    },
  ],
}));

const config = (): GameConfig => ({
  mode: 'local',
  board: BUILTIN_BOARDS[0]!,
  levelId: 'tiny',
  players: [
    { name: 'Noa', color: 'coral', avatar: 'fox' },
    { name: 'Avi', color: 'sky', avatar: 'fox' },
  ],
  tabletop: false,
});
const fixedDeal = async () => [
  'animals/a',
  'animals/b',
  'animals/c',
  'animals/a',
  'animals/b',
  'animals/c',
];

describe('game session store', () => {
  beforeEach(() => useGameSession.getState().clear());

  it('starts a game and applies actions through the engine', async () => {
    const s = await useGameSession.getState().start(config(), fixedDeal);
    expect(s.state.cards).toHaveLength(6);
    const store = useGameSession.getState();
    expect(store.dispatch({ type: 'flip', index: 0 })).toBe(true);
    expect(store.dispatch({ type: 'flip', index: 0 })).toBe(false);
    expect(useGameSession.getState().session?.state.flipped).toEqual([0]);
  });

  it('rematch deals again and lets the other player start', async () => {
    await useGameSession.getState().start(config(), fixedDeal, 0);
    const first = useGameSession.getState().session!.id;
    const re = await useGameSession.getState().rematch(fixedDeal);
    expect(re?.state.currentPlayer).toBe(1);
    expect(re?.id).not.toBe(first);
  });

  it('tracks play time across pauses and stops at the end', async () => {
    await useGameSession.getState().start(config(), fixedDeal);
    const { resumeTimer, pauseTimer } = useGameSession.getState();
    resumeTimer(1000);
    pauseTimer(4000);
    resumeTimer(10000);
    expect(sessionElapsed(useGameSession.getState().session!, 12000)).toBe(5000);
  });
});
