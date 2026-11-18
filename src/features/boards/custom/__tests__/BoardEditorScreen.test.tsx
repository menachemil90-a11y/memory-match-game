/* eslint-disable import/first -- modules must load after jest.mock() */
/**
 * Renders the real board editor screen for a normal photo board (all files
 * present). Regression test for the infinite render loop caused by a store
 * selector that returned a new array on every call.
 */
import { createTestDb } from '@/lib/db/__tests__/nodeSqliteDb';
import { migrate } from '@/lib/db/migrations';

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

const mockParams: { boardId?: string } = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
}));

import { screen } from '@testing-library/react-native';

import BoardEditorScreen from '@/app/my-boards/[boardId]';
import { initI18n } from '@/lib/i18n';
import { renderScreen } from '@/test-utils/renderScreen';

import { useCustomBoards } from '../customBoardsStore';

beforeAll(async () => {
  initI18n();
  await mockDb.execAsync('PRAGMA foreign_keys = ON');
  await migrate(mockDb);
});

it('renders the editor of a normal photo board without looping', async () => {
  const store = useCustomBoards.getState();
  await store.load();
  const { boardId } = await store.createBoard('Family', [
    'content://a',
    'content://b',
    'content://c',
  ]);
  mockParams.boardId = boardId;

  const errors = jest.spyOn(console, 'error');
  await renderScreen(<BoardEditorScreen />);

  expect(screen.getByDisplayValue('Family')).toBeTruthy();
  expect(screen.getAllByLabelText(/^Photo \d/)).toHaveLength(3);
  // React reports "Maximum update depth exceeded" / uncached getSnapshot here.
  expect(errors).not.toHaveBeenCalled();
  errors.mockRestore();
});
