import { ensureSignedIn, fetchMyRoomByCode } from '../api';
import { useOnline } from '../onlineStore';
import type { RoomRow } from '../room';

jest.mock('../supabaseClient', () => ({ getSupabase: () => null }));
jest.mock('../hostPhotoRoom', () => ({ pickRoomPhotos: jest.fn(), roomCardJpeg: jest.fn() }));
jest.mock('../api', () => ({
  ensureSignedIn: jest.fn(),
  fetchMyRoomByCode: jest.fn(),
  currentUserId: jest.fn(async () => 'guest-1'),
  fetchMinSupportedVersion: jest.fn(async () => null),
  fetchRoom: jest.fn(async () => null),
  onlineApi: { heartbeat: jest.fn(async () => ''), serverTime: jest.fn(async () => '') },
}));

const playing = {
  id: 'r1',
  code: 'ABC234',
  status: 'playing',
  host_id: 'host-1',
  guest_id: 'guest-1',
  photo_ids: null,
} as unknown as RoomRow;

beforeEach(() => {
  jest.clearAllMocks();
  useOnline.getState().detach();
});

describe('back into my room after a reload', () => {
  it('finds the room this player is in and continues as the same seat', async () => {
    jest.mocked(fetchMyRoomByCode).mockResolvedValue(playing);
    await expect(useOnline.getState().resume('ABC234')).resolves.toBe(true);
    expect(useOnline.getState()).toMatchObject({ room: playing, seat: 1, joining: false });
  });

  it('a visitor who is not in the room stays on the invitation (and is not signed in)', async () => {
    jest.mocked(fetchMyRoomByCode).mockResolvedValue(null);
    await expect(useOnline.getState().resume('ABC234')).resolves.toBe(false);
    expect(useOnline.getState().room).toBeNull();
    expect(ensureSignedIn).not.toHaveBeenCalled();
  });
});
