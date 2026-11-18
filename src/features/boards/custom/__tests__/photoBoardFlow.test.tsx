/* eslint-disable import/first -- modules must load after jest.mock() */
/**
 * The whole photo-board flow through the real screens, store, SQLite and
 * (faked) phone storage: create → rename → cover → re-crop → add → delete
 * photos (below the minimum) → locked levels → delete board → play a game.
 */
import { createTestDb } from '@/lib/db/__tests__/nodeSqliteDb';
import { migrate } from '@/lib/db/migrations';

import type * as ReactModule from 'react';

import type * as NativeFakes from './nativeFakes';

jest.mock('expo-crypto', () =>
  jest.requireActual<typeof NativeFakes>('./nativeFakes').fakeCrypto(),
);
jest.mock('expo-file-system', () =>
  jest.requireActual<typeof NativeFakes>('./nativeFakes').fakeFileSystem(),
);
jest.mock('expo-image-manipulator', () =>
  jest.requireActual<typeof NativeFakes>('./nativeFakes').fakeImageManipulator(),
);

const mockDb = createTestDb();
jest.mock('@/lib/db', () => ({ getDb: async () => mockDb }));

/** Photos the (mocked) system photo picker returns, one batch per call. */
const mockPickerBatches: string[][] = [];
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => {
    const uris = mockPickerBatches.shift() ?? [];
    return uris.length
      ? { canceled: false, assets: uris.map((uri) => ({ uri })) }
      : { canceled: true, assets: [] };
  }),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}));

const mockParams: Record<string, string | undefined> = {};
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  dismissAll: jest.fn(),
  canGoBack: jest.fn(() => true),
};
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof ReactModule>('react');
  return {
    // Getter: the factory runs before `mockRouter` is initialised (jest hoisting).
    get router() {
      return mockRouter;
    },
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    Redirect: () => null,
  };
});

import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import BoardPickerScreen from '@/app/boards';
import GameScreen from '@/app/game';
import LevelPickerScreen from '@/app/levels';
import BoardEditorScreen from '@/app/my-boards/[boardId]';
import MyBoardsScreen from '@/app/my-boards';
import NewBoardScreen from '@/app/my-boards/new';
import { useGameSession } from '@/features/game/gameSessionStore';
import { initI18n } from '@/lib/i18n';
import { renderScreen } from '@/test-utils/renderScreen';

import { useCustomBoards } from '../customBoardsStore';

import { boardFiles, fakeState } from './nativeFakes';

const store = () => useCustomBoards.getState();
const theBoard = () => store().boards[0]!;
const FSI = '⁨';
const PDI = '⁩';

const setParams = (params: Record<string, string | undefined>) => {
  for (const k of Object.keys(mockParams)) delete mockParams[k];
  Object.assign(mockParams, params);
};

/** Lets async store work (SQLite, file writes) started by an event finish. */
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 30)));

/** Presses a button by its accessible name and lets async store work settle. */
async function press(name: string | RegExp) {
  await fireEvent.press(screen.getByRole('button', { name }));
  await settle();
}

async function pressEl(element: Parameters<typeof fireEvent.press>[0]) {
  await fireEvent.press(element);
  await settle();
}

let consoleErrors: jest.SpyInstance;
/** Set by the game test: React's act() warnings from the game's own real-time timers. */
let allowRealTimerActWarnings = false;
const ACT_ENVIRONMENT_WARNING = /not wrapped in act|overlapping act\(\) calls/;

beforeAll(async () => {
  initI18n();
  await mockDb.execAsync('PRAGMA foreign_keys = ON');
  await migrate(mockDb);
});

beforeEach(() => {
  jest.clearAllMocks();
  consoleErrors = jest.spyOn(console, 'error');
});

afterEach(() => {
  // No screen may log an error (render loops, failed actions, …).
  const errors = consoleErrors.mock.calls.filter(
    ([message]) => !(allowRealTimerActWarnings && ACT_ENVIRONMENT_WARNING.test(String(message))),
  );
  allowRealTimerActWarnings = false;
  consoleErrors.mockRestore();
  expect(errors).toEqual([]);
});

it('1. creating a board needs a name and at least 3 photos', async () => {
  await renderScreen(<NewBoardScreen />);
  const create = () => screen.getByTestId('create-board');

  await fireEvent.changeText(screen.getByLabelText('Board name'), 'משפחה');
  mockPickerBatches.push(['content://a', 'content://b']);
  await press('Choose photos');
  expect(screen.getByText('2 photos chosen')).toBeTruthy();
  expect(screen.getByText('Choose at least 1 more photo to create the board.')).toBeTruthy();
  expect(create()).toBeDisabled();

  mockPickerBatches.push(['content://c']);
  await press('Choose photos');
  expect(create()).toBeEnabled();
  await pressEl(create());

  expect(store().boards).toHaveLength(1);
  expect(theBoard()).toMatchObject({ name: 'משפחה' });
  expect(theBoard().photos).toHaveLength(3);
  expect(mockRouter.replace).toHaveBeenCalledWith({
    pathname: '/my-boards/crop',
    params: {
      boardId: theBoard().id,
      ids: theBoard()
        .photos.map((p) => p.id)
        .join(','),
    },
  });
});

it('2. the editor renames (refusing an empty name) and changes the cover', async () => {
  setParams({ boardId: theBoard().id });
  await renderScreen(<BoardEditorScreen />);
  const name = screen.getByLabelText('Board name');

  await fireEvent.changeText(name, '   ');
  await fireEvent(name, 'endEditing');
  await settle();
  expect(screen.getByText('Give your board a name first.')).toBeTruthy();
  await press('OK');
  expect(theBoard().name).toBe('משפחה');
  expect(screen.getByDisplayValue('משפחה')).toBeTruthy();

  await fireEvent.changeText(name, 'משפחה שלנו');
  await fireEvent(name, 'endEditing');
  await settle();
  expect(theBoard().name).toBe('משפחה שלנו');

  const third = theBoard().photos[2]!;
  await press('Photo 3');
  await press('Use as cover');
  expect(theBoard().coverPhotoId).toBe(third.id);
});

it('3. re-cropping opens the crop queue for that photo and saves a new card', async () => {
  setParams({ boardId: theBoard().id });
  await renderScreen(<BoardEditorScreen />);
  const photo = theBoard().photos[0]!;
  await press(/^Photo 1/);
  await press('Crop again');
  expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: '/my-boards/crop',
    params: { boardId: theBoard().id, ids: photo.id, returnTo: 'back' },
  });
  // What the crop screen does on "Done" (the gesture cropper itself needs a device).
  await act(() => store().saveCrop(photo, { rotation: 90, originX: 0, originY: 0, size: 1000 }));
  const updated = theBoard().photos[0]!;
  expect(updated.cardFile).not.toBe(photo.cardFile);
  expect(fakeState.files.has(`doc/boards/${theBoard().id}/${photo.cardFile}`)).toBe(false);
});

it('4. adds photos from the editor and returns from the crop queue', async () => {
  setParams({ boardId: theBoard().id });
  await renderScreen(<BoardEditorScreen />);
  mockPickerBatches.push(['content://d']);
  await press('Add photos');
  await press('Choose photos');
  expect(theBoard().photos).toHaveLength(4);
  expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: '/my-boards/crop',
    params: { boardId: theBoard().id, ids: theBoard().photos[3]!.id, returnTo: 'back' },
  });
});

it('5. deletes photos with a confirmation, removes their files, and guides below 3', async () => {
  const id = theBoard().id;
  setParams({ boardId: id });
  await renderScreen(<BoardEditorScreen />);

  for (const remaining of [3, 2]) {
    const victim = theBoard().photos.at(-1)!;
    await press(new RegExp(`^Photo ${remaining + 1}`));
    await press('Delete photo');
    if (remaining < 3) {
      expect(
        screen.getByText(
          'The board will have 2 photos left. You will need to add 1 more photo to play.',
        ),
      ).toBeTruthy();
    }
    await pressEl(screen.getByTestId('confirm-delete-photo'));
    expect(theBoard().photos).toHaveLength(remaining);
    for (const f of [victim.sourceFile, victim.cardFile, victim.thumbFile]) {
      expect(fakeState.files.has(`doc/boards/${id}/${f}`)).toBe(false);
    }
  }

  // Not a dead end: the editor explains and offers to add photos; play is disabled.
  expect(screen.getByText('This board needs more photos')).toBeTruthy();
  expect(screen.getByText('Add 1 more photo to start playing.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Play solo' })).toBeDisabled();
  expect(screen.getAllByRole('button', { name: 'Add photos' }).length).toBeGreaterThan(0);
});

it('6. the level screen shows the Hebrew name and turns locked levels into "add photos"', async () => {
  setParams({ mode: 'solo', boardId: theBoard().id });
  await renderScreen(<LevelPickerScreen />);

  // The name is rendered exactly as stored (logical order — the OS lays out RTL).
  expect(screen.getByText('משפחה שלנו')).toBeTruthy();
  expect(screen.getByText('This board needs more photos')).toBeTruthy();

  await press(/^Tiny, locked/);
  expect(screen.getByText('Tiny needs 3 photos')).toBeTruthy();
  expect(
    screen.getByText('This board has 2 photos. Add 1 more photo to unlock Tiny.'),
  ).toBeTruthy();
  // The dialog's "Add photos" (the notice card has one too).
  await pressEl(screen.getAllByRole('button', { name: 'Add photos' }).at(-1)!);
  expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: '/my-boards/[boardId]',
    params: { boardId: theBoard().id, add: '1' },
  });

  await press('Edit board');
  expect(mockRouter.push).toHaveBeenLastCalledWith({
    pathname: '/my-boards/[boardId]',
    params: { boardId: theBoard().id },
  });
});

it('7. "add=1" opens the editor straight in "Add photos"', async () => {
  setParams({ boardId: theBoard().id, add: '1' });
  mockPickerBatches.push(['content://e', 'content://f']);
  await renderScreen(<BoardEditorScreen />);
  await press('Choose photos');
  expect(theBoard().photos).toHaveLength(4);
});

it('8. the board picker shows an edit button on photo boards', async () => {
  setParams({ mode: 'solo' });
  await renderScreen(<BoardPickerScreen />);
  await press(`Edit ${FSI}משפחה שלנו${PDI}`);
  expect(mockRouter.push).toHaveBeenCalledWith(`/my-boards/${theBoard().id}`);
});

it('9. deletes the whole board from My Boards: confirmation, rows and files gone', async () => {
  const id = theBoard().id;
  expect(boardFiles(id).length).toBeGreaterThan(0);
  await renderScreen(<MyBoardsScreen />);
  await press(`Delete ${FSI}משפחה שלנו${PDI}`);
  expect(screen.getByText(`Delete "${FSI}משפחה שלנו${PDI}"?`)).toBeTruthy();
  await pressEl(screen.getByTestId('confirm-delete-board'));

  expect(store().boards).toHaveLength(0);
  expect([...fakeState.files.keys()].some((k) => k.startsWith(`doc/boards/${id}`))).toBe(false);
  expect(await mockDb.getAllAsync('SELECT id FROM custom_photos')).toEqual([]);
  expect(
    screen.getByText('Make a board from your own photos — family, pets, friends, anything!'),
  ).toBeTruthy();
});

it('10. deleting from the editor leaves for My Boards (no screen of a deleted board)', async () => {
  const { boardId } = await store().createBoard('Temp', [
    'content://x',
    'content://y',
    'content://z',
  ]);
  setParams({ boardId });
  await renderScreen(<BoardEditorScreen />);
  await press('Delete board');
  await pressEl(screen.getByTestId('confirm-delete-board'));
  expect(store().boards.some((b) => b.id === boardId)).toBe(false);
  expect(boardFiles(boardId)).toEqual([]);
  expect(mockRouter.dismissAll).toHaveBeenCalled();
  expect(mockRouter.push).toHaveBeenCalledWith('/my-boards');
});

// Last: real-time game timers leave React's test renderer unusable for later renders.
it('11. plays a full game on a photo board (no freezes)', async () => {
  // Real time: the game's own flip / reveal delays run exactly as on a phone.
  // Their state updates land between test steps, which React reports as
  // act() warnings in a test; those (and only those) are expected here.
  allowRealTimerActWarnings = true;
  const wait = (ms: number) => act(() => new Promise<void>((r) => setTimeout(r, ms)));
  const { boardId } = await store().createBoard('Game', [
    'content://g1',
    'content://g2',
    'content://g3',
  ]);
  setParams({ mode: 'solo', boardId });
  await renderScreen(<LevelPickerScreen />);
  await press(/^Tiny, 3 pairs/);
  expect(mockRouter.push).toHaveBeenCalledWith('/game');
  expect(useGameSession.getState().session?.config.board.id).toBe(boardId);

  screen.unmount();
  await renderScreen(<GameScreen />);
  // A phone reports the grid's size; the cards are laid out from it.
  await fireEvent(screen.getByTestId('game-grid'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 480 } },
  });
  await wait(1500); // image preload + deal-in

  const cards = 6;
  const cardEl = (i: number) => screen.getByLabelText(new RegExp(`^Card ${i + 1},`));
  const faceOf = (i: number) =>
    (cardEl(i).props.accessibilityLabel as string).replace(/^Card \d+, /, '');
  const seen = new Map<number, string>(); // card index → photo label (only when face up)
  const flip = async (i: number) => {
    await fireEvent.press(cardEl(i));
    await wait(450);
    const face = faceOf(i);
    expect(face).not.toBe('face down'); // the tap was accepted
    seen.set(i, face);
  };

  const matched = new Set<number>();
  for (let turn = 0; turn < 12 && matched.size < cards; turn++) {
    const open = [...Array(cards).keys()].filter((i) => !matched.has(i));
    const pairOf = (i: number) => open.find((j) => j !== i && seen.get(j) === seen.get(i));
    const knownPair = open.find((i) => seen.has(i) && pairOf(i) !== undefined);
    const a = knownPair ?? open.find((i) => !seen.has(i))!;
    await flip(a);
    const b = pairOf(a) ?? open.find((j) => j !== a && !seen.has(j))!;
    await flip(b);
    if (seen.get(a) === seen.get(b)) {
      matched.add(a);
      matched.add(b);
      // On a phone the pair flies to the pile and its animation-end callback
      // resolves the turn; Reanimated's Jest mock never runs those callbacks, so
      // here the game's 2.9 s resolve timer finishes the turn instead.
      await wait(3200);
    } else {
      await fireEvent.press(cardEl(a)); // tap to skip the mismatch delay, like a player
      await wait(1300);
    }
  }
  expect(matched.size).toBe(cards);
  await waitFor(() => expect(useGameSession.getState().session?.state.phase).toBe('finished'));
  await wait(1000); // results navigation
  expect(mockRouter.replace).toHaveBeenCalledWith('/results');
  screen.unmount();
  useGameSession.getState().clear();
}, 60_000);
