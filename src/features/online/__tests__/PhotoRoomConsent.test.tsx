import { act, fireEvent, screen } from '@testing-library/react-native';

import NewOnlineGameScreen from '@/app/online/new';
import type { Board } from '@/features/boards/types';
import { initI18n } from '@/lib/i18n';
import { renderScreen } from '@/test-utils/renderScreen';

import { useOnline } from '../onlineStore';

jest.mock('../supabaseClient', () => ({ getSupabase: () => null }));
jest.mock('../hostPhotoRoom', () => ({ pickRoomPhotos: jest.fn(), roomCardJpeg: jest.fn() }));

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => ({ boardId: mockBoard.id }),
}));

const photo = (id: string) => ({
  id,
  label: id,
  source: { uri: `file:///boards/custom-1/${id}.jpg` },
  kind: 'photo' as const,
  background: '#fff',
});
let mockBoard: Board = {
  id: 'custom-1',
  kind: 'custom',
  name: 'Family',
  cardBack: 'coral-dots',
  accent: '#f00',
  coverImageId: 'a',
  images: ['a', 'b', 'c', 'd', 'e', 'f'].map(photo),
};
jest.mock('@/features/boards/useBoard', () => ({
  useBoard: () => mockBoard,
  useBoardName: (b: { name: string | null } | null) => b?.name ?? 'Animals',
}));

const createPhotoRoom = jest.fn();
const createRoom = jest.fn();

beforeAll(() => {
  initI18n();
});

beforeEach(() => {
  jest.clearAllMocks();
  useOnline.setState({ createPhotoRoom, createRoom });
});

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 20)));

describe('photo board online: consent before anything is sent', () => {
  it('asks first; Cancel sends nothing', async () => {
    await renderScreen(<NewOnlineGameScreen />);
    await fireEvent.press(screen.getByLabelText('Tiny, 3 pairs'));

    expect(screen.getByText('Play with your photos?')).toBeTruthy();
    expect(screen.getByText(/3 small cards from/)).toBeTruthy();
    expect(screen.getByText(/always within 24 hours/)).toBeTruthy();
    expect(createPhotoRoom).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    await settle();
    expect(createPhotoRoom).not.toHaveBeenCalled();
    expect(screen.queryByText('Play with your photos?')).toBeNull();
  });

  it('confirming creates the photo room and opens it', async () => {
    createPhotoRoom.mockResolvedValue({ code: 'ABC234' });
    await renderScreen(<NewOnlineGameScreen />);
    await fireEvent.press(screen.getByLabelText('Easy, 6 pairs'));
    expect(screen.getByText(/6 small cards from/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Share and create game' }));
    await settle();
    expect(createPhotoRoom).toHaveBeenCalledWith(
      mockBoard,
      'easy',
      expect.any(String),
      expect.any(String),
      expect.any(Function),
    );
    expect(createRoom).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/online/ABC234');
  });

  it('built-in boards open a room without the photo question', async () => {
    const saved = mockBoard;
    mockBoard = { ...saved, id: 'animals', kind: 'builtin', name: null };
    createRoom.mockResolvedValue({ code: 'XYZ234' });
    await renderScreen(<NewOnlineGameScreen />);
    await fireEvent.press(screen.getByLabelText('Tiny, 3 pairs'));
    await settle();
    expect(screen.queryByText('Play with your photos?')).toBeNull();
    expect(createRoom).toHaveBeenCalledWith(
      'animals',
      'tiny',
      expect.any(String),
      expect.any(String),
    );
    mockBoard = saved;
  });
});
