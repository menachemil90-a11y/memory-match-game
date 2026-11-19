import { fireEvent, screen } from '@testing-library/react-native';
import type * as ReactNative from 'react-native';

import { initI18n } from '@/lib/i18n';
import { renderScreen } from '@/test-utils/renderScreen';

import { OnlineRoomGame } from '../OnlineRoomGame';
import { useOnline } from '../onlineStore';
import type { RoomRow } from '../room';
import { photoRoomBoard, type PhotoRoom } from '../roomPhotos';

jest.mock('../supabaseClient', () => ({ getSupabase: () => null }));
jest.mock('../hostPhotoRoom', () => ({ pickRoomPhotos: jest.fn(), roomCardJpeg: jest.fn() }));
jest.mock('expo-router', () => ({ router: { dismissTo: jest.fn() } }));
jest.mock('../OnlineGameView', () => ({
  OnlineGameView: ({ board }: { board: { id: string; images: unknown[] } }) => {
    const { Text } = jest.requireActual<typeof ReactNative>('react-native');
    return <Text>{`game on ${board.id} with ${board.images.length} cards`}</Text>;
  },
}));

const room = (patch: Partial<RoomRow> = {}) =>
  ({
    id: 'room-1',
    code: 'ABC234',
    board_id: 'animals',
    level_id: 'tiny',
    status: 'playing',
    host_id: 'h',
    guest_id: 'g',
    players: [],
    game_number: 1,
    version: 1,
    photo_ids: null,
    card_back: null,
    ...patch,
  }) as RoomRow;
const photoRoom = room({ board_id: 'photos', photo_ids: ['p1', 'p2', 'p3'] }) as PhotoRoom;

const loadPhotoBoard = jest.fn(async () => undefined);

beforeAll(() => {
  initI18n();
});
beforeEach(() => {
  jest.clearAllMocks();
  useOnline.setState({ loadPhotoBoard, photoBoard: null, photoBoardStatus: 'idle' });
});

describe('OnlineRoomGame', () => {
  it('plays built-in boards straight away', async () => {
    await renderScreen(<OnlineRoomGame room={room()} seat={1} />);
    expect(screen.getByText('game on animals with 24 cards')).toBeTruthy();
    expect(loadPhotoBoard).not.toHaveBeenCalled();
  });

  it('a photo room waits for the cards, then plays with them', async () => {
    useOnline.setState({ photoBoardStatus: 'loading' });
    const view = await renderScreen(<OnlineRoomGame room={photoRoom} seat={1} />);
    expect(screen.getByText('Getting the photos ready…')).toBeTruthy();
    expect(loadPhotoBoard).toHaveBeenCalledTimes(1);

    const board = photoRoomBoard(
      photoRoom,
      new Map(['p1', 'p2', 'p3'].map((id) => [id, `https://x/${id}`])),
    );
    useOnline.setState({ photoBoard: board, photoBoardStatus: 'ready' });
    await view.rerender(<OnlineRoomGame room={photoRoom} seat={1} />);
    expect(screen.getByText('game on room:room-1 with 3 cards')).toBeTruthy();
  });

  it('offers Try again when the cards could not be loaded', async () => {
    useOnline.setState({ photoBoardStatus: 'failed' });
    await renderScreen(<OnlineRoomGame room={photoRoom} seat={1} />);
    expect(screen.getByText(/Couldn't load the photos/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(loadPhotoBoard).toHaveBeenCalledTimes(2);
  });
});
