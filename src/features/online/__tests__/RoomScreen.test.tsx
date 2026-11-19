import { act } from '@testing-library/react-native';

import OnlineRoomScreen from '@/app/online/[code]';
import { usePlayersStore } from '@/features/players/playersStore';
import { initI18n } from '@/lib/i18n';
import { renderScreen } from '@/test-utils/renderScreen';

import { useOnline } from '../onlineStore';
import type { RoomRow } from '../room';

jest.mock('../supabaseClient', () => ({ getSupabase: () => null }));
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
jest.mock('../hostPhotoRoom', () => ({ pickRoomPhotos: jest.fn(), roomCardJpeg: jest.fn() }));
jest.mock('../config', () => ({
  ...jest.requireActual<object>('../config'),
  isOnlineConfigured: true,
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true, dismissTo: jest.fn() },
  useLocalSearchParams: () => ({ code: 'ABC234' }),
}));

const waiting = {
  id: 'r1',
  code: 'ABC234',
  status: 'waiting',
  host_id: 'me',
  guest_id: null,
  players: [{ name: 'Noa', avatar: 'fox' }],
  photo_ids: null,
} as unknown as RoomRow;

const joinRoom = jest.fn(async () => waiting);

beforeAll(() => {
  initI18n();
});
beforeEach(() => {
  jest.clearAllMocks();
  usePlayersStore.getState().setOnline({ name: 'Noa', avatar: 'fox' });
});

describe('room screen', () => {
  it('opened from an invite link: joins the room once', async () => {
    useOnline.setState({ room: null, seat: null, joinRoom });
    await renderScreen(<OnlineRoomScreen />);
    expect(joinRoom).toHaveBeenCalledTimes(1);
    expect(joinRoom).toHaveBeenCalledWith('ABC234', 'Noa', 'fox');
  });

  it('the host leaving the room does not join it again', async () => {
    useOnline.setState({ room: waiting, seat: 0, joinRoom });
    await renderScreen(<OnlineRoomScreen />);
    expect(joinRoom).not.toHaveBeenCalled();
    // Back to menu / Cancel: the store forgets the room while the screen is still open.
    await act(async () => {
      useOnline.setState({ room: null, seat: null });
    });
    expect(joinRoom).not.toHaveBeenCalled();
  });
});
