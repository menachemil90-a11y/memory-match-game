import { screen } from '@testing-library/react-native';

import { initI18n } from '@/lib/i18n';
import { renderScreen } from '@/test-utils/renderScreen';

import { OnlineResults } from '../components/OnlineResults';
import type { RoomRow } from '../room';

jest.mock('../supabaseClient', () => ({ getSupabase: () => null }));
jest.mock('../hostPhotoRoom', () => ({ pickRoomPhotos: jest.fn(), roomCardJpeg: jest.fn() }));
jest.mock('expo-router', () => ({ router: { dismissTo: jest.fn() } }));
// Confetti only draws (Skia); not part of what is tested here.
jest.mock('@/ui/components/Confetti', () => ({ Confetti: () => null }));

const finished = (patch: Partial<RoomRow> = {}) =>
  ({
    id: 'r1',
    code: 'ABC234',
    status: 'finished',
    players: [
      { name: 'Noa', avatar: 'fox' },
      { name: 'Avi', avatar: 'panda' },
    ],
    collected: [[], []],
    moves: [3, 2],
    winner: 0,
    end_reason: 'complete',
    rematch: [],
    ...patch,
  }) as RoomRow;

beforeAll(() => {
  initI18n();
});

describe('online results', () => {
  it('offers a rematch after a complete game', async () => {
    await renderScreen(<OnlineResults room={finished()} seat={0} images={new Map()} />);
    expect(screen.getByText('You win!')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rematch' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back to menu' })).toBeTruthy();
  });

  it('stays on screen when the opponent goes back to the menu (room closed)', async () => {
    await renderScreen(
      <OnlineResults room={finished({ status: 'closed' })} seat={0} images={new Map()} />,
    );
    expect(screen.getByText('You win!')).toBeTruthy();
    expect(screen.getByText(/Avi.* has left the game\./)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Rematch' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Back to menu' })).toBeTruthy();
  });
});
