import { screen } from '@testing-library/react-native';

import { initI18n } from '@/lib/i18n';
import { renderScreen } from '@/test-utils/renderScreen';

import { PlayerPanel } from '../components/PlayerPanel';

beforeAll(() => {
  initI18n();
});

describe('PlayerPanel', () => {
  const panel = (active: boolean) => (
    <PlayerPanel
      profile={{ name: 'Noa', color: 'coral', avatar: 'fox' }}
      displayName="Noa"
      collected={[]}
      active={active}
      reduceMotion
    />
  );

  it('says whose turn it is — not by color alone (screen readers, tests)', async () => {
    const view = await renderScreen(panel(true));
    expect(screen.getByLabelText('Noa, 0 pairs, playing now')).toBeTruthy();
    await view.rerender(panel(false));
    expect(screen.getByLabelText('Noa, 0 pairs')).toBeTruthy();
  });
});
