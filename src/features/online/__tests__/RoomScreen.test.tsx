import { act, fireEvent, screen } from '@testing-library/react-native';

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
  useLocalSearchParams: () => mockParams,
}));
let mockParams: Record<string, string> = { code: 'ABC234' };

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
const resume = jest.fn(async () => false);

beforeAll(() => {
  initI18n();
});
beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { code: 'ABC234' };
  useOnline.setState({ room: null, seat: null, joinRoom, resume });
  usePlayersStore.getState().setOnline({ name: 'Noa', avatar: 'fox' });
});

describe('room screen', () => {
  it('an invite link shows the invitation: the friend picks a name and avatar, then joins', async () => {
    usePlayersStore.getState().setOnline({ name: '', avatar: 'fox' });
    await renderScreen(<OnlineRoomScreen />);
    expect(screen.getByText("You're invited to a game!")).toBeTruthy();
    expect(joinRoom).not.toHaveBeenCalled();
    // Not already in this room (a reload would have put them back in).
    expect(resume).toHaveBeenCalledWith('ABC234');
    // No red error on arrival — only after tapping Join without a name.
    expect(screen.queryByText('Please choose a nickname.')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Join the game' }));
    expect(screen.getByText('Please choose a nickname.')).toBeTruthy();
    expect(joinRoom).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByPlaceholderText('Your nickname'), 'Avi');
    await fireEvent.press(screen.getByRole('button', { name: 'Join the game' }));
    expect(joinRoom).toHaveBeenCalledTimes(1);
    expect(joinRoom).toHaveBeenCalledWith('ABC234', 'Avi', 'fox');
  });

  it('a returning friend sees their saved name and joins with one tap', async () => {
    await renderScreen(<OnlineRoomScreen />);
    expect(screen.getByDisplayValue('Noa')).toBeTruthy();
    expect(joinRoom).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Join the game' }));
    expect(joinRoom).toHaveBeenCalledWith('ABC234', 'Noa', 'fox');
  });

  it("the lobby's Join (name already chosen there) joins right away, once", async () => {
    mockParams = { code: 'ABC234', join: '1' };
    await renderScreen(<OnlineRoomScreen />);
    expect(joinRoom).toHaveBeenCalledTimes(1);
    expect(resume).not.toHaveBeenCalled();
  });

  it('the host leaving the room does not join it again', async () => {
    useOnline.setState({ room: waiting, seat: 0 });
    await renderScreen(<OnlineRoomScreen />);
    expect(joinRoom).not.toHaveBeenCalled();
    expect(resume).not.toHaveBeenCalled();
    // Back to menu / Cancel: the store forgets the room while the screen is still open.
    await act(async () => {
      useOnline.setState({ room: null, seat: null });
    });
    expect(joinRoom).not.toHaveBeenCalled();
  });
});
