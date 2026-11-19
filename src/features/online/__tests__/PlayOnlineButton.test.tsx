/* eslint-disable import/first -- modules must load after jest.mock() */
/**
 * Board editor → "Play online": straight to choosing the level of an online
 * game with this board; asks for the online name first if there is none.
 */
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('../config', () => ({ isOnlineConfigured: true }));
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

import { fireEvent, screen } from '@testing-library/react-native';

import { usePlayersStore } from '@/features/players/playersStore';
import { initI18n } from '@/lib/i18n';
import { renderScreen } from '@/test-utils/renderScreen';

import { PlayOnlineButton } from '../PlayOnlineButton';

const setName = (name: string) =>
  usePlayersStore.setState({ online: { ...usePlayersStore.getState().online, name } });

beforeAll(() => initI18n());
beforeEach(() => mockPush.mockClear());

it('with an online name, goes straight to the level choice for this board', async () => {
  setName('Dana');
  await renderScreen(<PlayOnlineButton boardId="custom-1" />);
  await fireEvent.press(screen.getByTestId('play-online'));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/online/new',
    params: { boardId: 'custom-1' },
  });
});

it('without a name, asks for it first, then continues to the level choice', async () => {
  setName('');
  await renderScreen(<PlayOnlineButton boardId="custom-1" />);
  await fireEvent.press(screen.getByTestId('play-online'));
  expect(mockPush).not.toHaveBeenCalled();
  expect(screen.getByText('Your name for online games')).toBeTruthy();

  await fireEvent.press(screen.getByTestId('play-online-continue'));
  expect(mockPush).not.toHaveBeenCalled(); // still no valid name

  await fireEvent.changeText(screen.getByDisplayValue(''), 'Dana');
  await fireEvent.press(screen.getByTestId('play-online-continue'));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/online/new',
    params: { boardId: 'custom-1' },
  });
});
