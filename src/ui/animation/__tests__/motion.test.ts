import { MIN_DAMPING_RATIO, dampingRatio, springs } from '../motion';

describe('shared motion settings', () => {
  it('explains the wobble: a partial config on Reanimated 4 defaults is badly underdamped', () => {
    // `.springify().damping(14)` kept Reanimated 4's default stiffness 900 and mass 4.
    expect(dampingRatio({ damping: 14, stiffness: 900, mass: 4 })).toBeLessThan(0.2);
  });

  it('gives every spring a complete config that settles without visible bounce', () => {
    for (const [name, config] of Object.entries(springs)) {
      expect({ name, damping: typeof config.damping, stiffness: typeof config.stiffness }).toEqual({
        name,
        damping: 'number',
        stiffness: 'number',
      });
      expect(config.mass).toBeGreaterThan(0);
      expect({ name, calm: dampingRatio(config) >= MIN_DAMPING_RATIO }).toEqual({
        name,
        calm: true,
      });
    }
  });
});
