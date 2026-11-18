import { Easing, Keyframe } from 'react-native-reanimated';

/**
 * The game's shared motion settings: every spring and every pop-in comes from here.
 *
 * Why this file exists (root cause of the "jumping" popups):
 * Reanimated 4 changed its default spring to `{ damping: 120, stiffness: 900, mass: 4 }`
 * (Reanimated 3 used `{ damping: 10, stiffness: 100, mass: 1 }`). Code written with the
 * old defaults in mind, like `ZoomIn.springify().damping(14)` or
 * `withSpring(1, { damping: 7, stiffness: 180 })`, overrode only some values and silently
 * inherited the heavy `mass: 4`. The result was a damping ratio of about 0.12: dialogs
 * swung to ~120% and ~55% of their size and kept wobbling for ~1.5 s.
 *
 * Rules:
 * - Springs always set damping, stiffness AND mass (`springs.*`), with a damping
 *   ratio of at least {@link MIN_DAMPING_RATIO}, so they settle without visible bounce.
 * - Popups and result cards appear with a short timed fade + slight scale
 *   (`popupEntering`, `heroEntering`), never with a layout spring.
 * Both rules are enforced by lint (eslint/animation-rules.js) and by tests.
 */

/** Damping ratio of a spring: 1 = no overshoot, lower = more bounce. */
export function dampingRatio(config: { damping: number; stiffness: number; mass: number }): number {
  return config.damping / (2 * Math.sqrt(config.stiffness * config.mass));
}

/** Every spring in the game must settle at least this calmly (≈ under 5% overshoot). */
export const MIN_DAMPING_RATIO = 0.7;

export const springs = {
  /** General settle (stars, the coin landing): ζ ≈ 0.81. */
  settle: { damping: 24, stiffness: 220, mass: 1 },
  /** Cards flying from the deck to their slots: ζ ≈ 0.77. */
  deal: { damping: 19, stiffness: 170, mass: 0.9 },
  /** On/off switch knob: ζ ≈ 0.75. */
  toggle: { damping: 26, stiffness: 300, mass: 1 },
} as const satisfies Record<string, { damping: number; stiffness: number; mass: number }>;

function popIn(fromScale: number, duration: number) {
  return new Keyframe({
    0: { opacity: 0, transform: [{ scale: fromScale }] },
    100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.out(Easing.cubic) },
  }).duration(duration);
}

/** Dialogs and popups: quick, calm fade + slight scale (no bounce). */
export const popupEntering = popIn(0.94, 180);

/** Result/celebration cards: a little longer and slightly larger scale, still no bounce. */
export const heroEntering = popIn(0.9, 260);

/** "New best!" badge on the results screen (appears after the stars). */
export const newBestEntering = popIn(0.9, 260).delay(1100);
