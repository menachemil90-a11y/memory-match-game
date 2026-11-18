import { render, screen } from '@testing-library/react-native';

import { motion } from '@/ui/theme';

import { TURN_BANNER_MS, TurnBanner } from '../components/TurnBanner';

describe('turn banner', () => {
  it('is gone by itself after a short, fixed time (readable, never stuck on the board)', () => {
    expect(TURN_BANNER_MS).toBe(
      motion.turnBanner.in + motion.turnBanner.hold + motion.turnBanner.out,
    );
    expect(TURN_BANNER_MS).toBeGreaterThanOrEqual(1000); // long enough to read
    expect(TURN_BANNER_MS).toBeLessThanOrEqual(1500); // gone before the player's first flip lands
    expect(motion.turnBanner.out).toBeGreaterThanOrEqual(300); // fades gradually, no hard cut
  });

  it('never intercepts taps on the cards underneath', async () => {
    await render(
      <TurnBanner
        playerIndex={1}
        enabled
        profile={{ name: 'Noa', avatar: 'fox', color: 'coral' }}
        text="Noa's turn!"
        rotated={false}
        reduceMotion={false}
      />,
    );
    const text = screen.getByText("Noa's turn!");
    let node: typeof text | null = text;
    while (node && node.props.pointerEvents !== 'none') node = node.parent;
    expect(node?.props.pointerEvents).toBe('none');
  });
});
