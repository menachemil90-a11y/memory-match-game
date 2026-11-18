import { Easing, withTiming } from 'react-native-reanimated';

/**
 * A springy "pop" to `target` that ends at an exact time.
 *
 * Use this instead of `withSpring` whenever something must happen after the
 * pop (the next step of a `withSequence`, a fade-out, a callback): Reanimated
 * only reports a spring as finished once its energy is ~0 (6e-9 of the
 * start), which for a bouncy spring takes 1.5–2 s after it *looks* settled —
 * the next step then starts far too late (the turn banner stayed on the board).
 * The `back` easing gives the same overshoot with a fixed duration.
 */
export function popTo(target: number, duration: number, overshoot = 1.8) {
  'worklet';
  return withTiming(target, { duration, easing: Easing.out(Easing.back(overshoot)) });
}
