import { CARD_BACK_IDS } from '@/features/boards/builtin';
import type { Board } from '@/features/boards/types';
import { initI18n } from '@/lib/i18n';

import { onlineApi, removeRoomPhotos, signRoomPhotos, uploadRoomPhoto } from '../api';
import { OnlineError, toOnlineError } from '../errors';
import { roomCardJpeg } from '../hostPhotoRoom';
import { useOnline } from '../onlineStore';
import type { RoomRow } from '../room';
import { isPhotoRoom, photoRoomBoard, roomPhotoPath } from '../roomPhotos';

jest.mock('../supabaseClient', () => ({ getSupabase: () => null }));
jest.mock('expo-image', () => ({ Image: { prefetch: jest.fn(async () => true) } }));
jest.mock('../hostPhotoRoom', () => ({
  // Deterministic: the first N photos, as in the board.
  pickRoomPhotos: (board: { images: unknown[] }, n: number) => board.images.slice(0, n),
  roomCardJpeg: jest.fn(async () => new ArrayBuffer(8)),
}));
jest.mock('../api', () => ({
  ensureSignedIn: jest.fn(async () => 'host-1'),
  fetchMinSupportedVersion: jest.fn(async () => null),
  fetchRoom: jest.fn(async () => null),
  uploadRoomPhoto: jest.fn(async () => undefined),
  signRoomPhotos: jest.fn(),
  removeRoomPhotos: jest.fn(async () => undefined),
  onlineApi: {
    createPhotoRoom: jest.fn(),
    photoRoomReady: jest.fn(),
    leaveRoom: jest.fn(),
    heartbeat: jest.fn(async () => new Date().toISOString()),
    serverTime: jest.fn(async () => new Date().toISOString()),
  },
}));

const { Image } = jest.requireMock('expo-image') as { Image: { prefetch: jest.Mock } };
const api = jest.mocked(onlineApi);

const room = (patch: Partial<RoomRow> = {}): RoomRow =>
  ({
    id: 'room-1',
    code: 'ABC234',
    board_id: 'photos',
    level_id: 'tiny',
    status: 'preparing',
    host_id: 'host-1',
    guest_id: null,
    players: [{ name: 'Noa', avatar: 'fox' }],
    game_number: 0,
    version: 0,
    photo_ids: ['p1', 'p2', 'p3'],
    card_back: 'coral-dots',
    ...patch,
  }) as RoomRow;

const photoBoard: Board = {
  id: 'custom-1',
  kind: 'custom',
  name: 'Family',
  cardBack: 'coral-dots',
  accent: '#f00',
  coverImageId: 'a',
  images: ['a', 'b', 'c', 'd'].map((id) => ({
    id,
    label: id,
    source: { uri: `file:///boards/custom-1/${id}.jpg` },
    kind: 'photo' as const,
    background: '#fff',
  })),
};

const signedFor = (r: RoomRow) =>
  new Map((r.photo_ids ?? []).map((id) => [roomPhotoPath(r.id, id), `https://x/sign/${id}?t=1`]));

beforeAll(() => {
  initI18n();
});

beforeEach(() => {
  jest.clearAllMocks();
  useOnline.getState().detach();
  useOnline.setState({ userId: 'host-1' });
});

describe('photo rooms: host creates a room', () => {
  it('uploads one small card per pair, then opens the room', async () => {
    api.createPhotoRoom.mockResolvedValue(room());
    api.photoRoomReady.mockResolvedValue(room({ status: 'waiting', version: 1 }));
    const progress: string[] = [];

    const opened = await useOnline
      .getState()
      .createPhotoRoom(photoBoard, 'tiny', 'Noa', 'fox', (p) =>
        progress.push(`${p.done}/${p.total}`),
      );

    expect(api.createPhotoRoom).toHaveBeenCalledWith('tiny', 'coral-dots', 'Noa', 'fox');
    expect(jest.mocked(roomCardJpeg).mock.calls.map(([img]) => img.id)).toEqual(['a', 'b', 'c']);
    expect(jest.mocked(uploadRoomPhoto).mock.calls.map(([path]) => path)).toEqual([
      'room-1/p1.jpg',
      'room-1/p2.jpg',
      'room-1/p3.jpg',
    ]);
    expect(progress).toEqual(['0/3', '1/3', '2/3', '3/3']);
    expect(api.photoRoomReady).toHaveBeenCalledWith('room-1');
    expect(opened.status).toBe('waiting');
    expect(useOnline.getState().room?.status).toBe('waiting');
    expect(useOnline.getState().seat).toBe(0);
  });

  it('a failed upload closes the room and deletes what was sent', async () => {
    api.createPhotoRoom.mockResolvedValue(room());
    api.leaveRoom.mockResolvedValue(room({ status: 'closed' }));
    jest
      .mocked(uploadRoomPhoto)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Network request failed'));

    const attempt = useOnline.getState().createPhotoRoom(photoBoard, 'tiny', 'Noa', 'fox');

    await expect(attempt).rejects.toMatchObject({ code: 'network' });
    expect(removeRoomPhotos).toHaveBeenCalledWith([
      'room-1/p1.jpg',
      'room-1/p2.jpg',
      'room-1/p3.jpg',
    ]);
    expect(api.leaveRoom).toHaveBeenCalledWith('room-1');
    expect(api.photoRoomReady).not.toHaveBeenCalled();
    expect(useOnline.getState().room).toBeNull();
  });

  it('reports a server without photo rooms as "not available"', () => {
    const missing = {
      code: 'PGRST202',
      message: 'Could not find the function public.create_photo_room(...) in the schema cache',
    };
    expect(toOnlineError(missing).code).toBe('not_available');
    expect(toOnlineError({ message: 'Bucket not found' }).code).toBe('not_available');
    expect(toOnlineError({ message: 'P0001: photos_missing' }).code).toBe('photos_missing');
  });
});

describe('photo rooms: both players see the cards', () => {
  const playing = () =>
    room({ status: 'playing', guest_id: 'guest-1', game_number: 1, version: 3 });

  it('builds the board from signed URLs, kept out of the disk cache', async () => {
    jest.mocked(signRoomPhotos).mockImplementation(async () => signedFor(playing()));
    useOnline.getState().attach(playing());

    await useOnline.getState().loadPhotoBoard();

    const { photoBoard: board, photoBoardStatus } = useOnline.getState();
    expect(photoBoardStatus).toBe('ready');
    expect(board?.id).toBe('room:room-1');
    expect(board?.cardBack).toBe('coral-dots');
    expect(board?.images.map((i) => [i.id, i.source, i.kind, i.ephemeral])).toEqual([
      ['p1', { uri: 'https://x/sign/p1?t=1' }, 'photo', true],
      ['p2', { uri: 'https://x/sign/p2?t=1' }, 'photo', true],
      ['p3', { uri: 'https://x/sign/p3?t=1' }, 'photo', true],
    ]);
    expect(board?.images[0]?.label).toBe('Photo 1');
    expect(Image.prefetch).toHaveBeenCalledWith(
      ['https://x/sign/p1?t=1', 'https://x/sign/p2?t=1', 'https://x/sign/p3?t=1'],
      'memory',
    );
  });

  it('signs once per room while the URLs are fresh', async () => {
    jest.mocked(signRoomPhotos).mockImplementation(async () => signedFor(playing()));
    useOnline.getState().attach(playing());
    await Promise.all([
      useOnline.getState().loadPhotoBoard(),
      useOnline.getState().loadPhotoBoard(),
    ]);
    await useOnline.getState().loadPhotoBoard();
    expect(signRoomPhotos).toHaveBeenCalledTimes(1);
  });

  it('shows "failed" (with Try again) when the cards cannot be loaded', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.mocked(signRoomPhotos).mockRejectedValueOnce(new OnlineError('network'));
    useOnline.getState().attach(playing());
    await useOnline.getState().loadPhotoBoard();
    expect(useOnline.getState().photoBoardStatus).toBe('failed');
    expect(warn).toHaveBeenCalled();

    jest.mocked(signRoomPhotos).mockImplementation(async () => signedFor(playing()));
    await useOnline.getState().loadPhotoBoard();
    expect(useOnline.getState().photoBoardStatus).toBe('ready');
    warn.mockRestore();
  });

  it('falls back to a known card back when the host has one this app lacks', () => {
    const board = photoRoomBoard(
      { ...playing(), card_back: 'from-the-future', photo_ids: ['p1'] },
      new Map([['p1', 'https://x']]),
    );
    expect(board.cardBack).toBe(CARD_BACK_IDS[0]);
  });

  it('built-in rooms are not photo rooms', () => {
    expect(isPhotoRoom(room({ photo_ids: null, board_id: 'animals' }))).toBe(false);
    expect(isPhotoRoom(room())).toBe(true);
  });
});

describe('photo rooms: leaving deletes the cards (host only)', () => {
  it('the host deletes the cards when the room closes', async () => {
    useOnline.getState().attach(room({ status: 'waiting' }));
    api.leaveRoom.mockResolvedValue(room({ status: 'closed' }));
    await useOnline.getState().leave();
    expect(removeRoomPhotos).toHaveBeenCalledWith([
      'room-1/p1.jpg',
      'room-1/p2.jpg',
      'room-1/p3.jpg',
    ]);
  });

  it('a forfeit keeps them for the friend’s results screen (the server deletes them later)', async () => {
    useOnline.getState().attach(room({ status: 'playing', guest_id: 'guest-1' }));
    api.leaveRoom.mockResolvedValue(room({ status: 'finished' }));
    await useOnline.getState().leave();
    expect(removeRoomPhotos).not.toHaveBeenCalled();
  });

  it('the friend who joined never deletes (or uploads) anything', async () => {
    jest.mocked(onlineApi.leaveRoom).mockResolvedValue(room({ status: 'closed' }));
    // Signed in as the guest.
    const { ensureSignedIn } = jest.requireMock('../api') as { ensureSignedIn: jest.Mock };
    ensureSignedIn.mockResolvedValueOnce('guest-1');
    await useOnline.getState().prepare();
    useOnline.getState().attach(room({ status: 'finished', guest_id: 'guest-1' }));
    expect(useOnline.getState().seat).toBe(1);
    await useOnline.getState().leave();
    expect(removeRoomPhotos).not.toHaveBeenCalled();
    expect(uploadRoomPhoto).not.toHaveBeenCalled();
  });
});
