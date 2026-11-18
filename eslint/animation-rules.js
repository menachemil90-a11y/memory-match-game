/**
 * Lint guard for Reanimated sequences.
 *
 * Reanimated reports a spring as finished only when its energy is ~0
 * (6e-9 of the start): a bouncy spring "looks" settled after ~0.4 s but
 * finishes 1.5–2 s later. Anything after it in a withSequence (a fade-out,
 * a settle-back) therefore starts far too late — the turn banner stayed on
 * the board and match pops stayed enlarged. A spring may only be the LAST
 * step of a sequence; use popTo() from src/ui/animation/pop for a timed pop.
 */
const animationRestrictions = [
  {
    selector:
      "CallExpression[callee.name='withSequence'] > CallExpression[callee.name='withSpring']:not(:last-child)",
    message:
      'withSpring may only be the last step of withSequence (Reanimated finishes springs 1.5–2 s after they look settled, so later steps start late). Use popTo() from @/ui/animation/pop.',
  },
];

/**
 * Lint guard for spring settings (root cause of the wobbling dialogs).
 *
 * Reanimated 4's default spring is { damping: 120, stiffness: 900, mass: 4 }.
 * A partial config (`.springify().damping(14)`, `withSpring(1, { damping: 7 })`)
 * keeps the heavy default mass and ends up with a damping ratio of ~0.1: popups
 * swung to ~120% / ~55% of their size for 1.5 s. Springs must come from the
 * shared, tested settings in src/ui/animation/motion.ts.
 */
const springRestrictions = [
  {
    selector: "CallExpression[callee.property.name='springify']",
    message:
      'No layout springs: use popupEntering / heroEntering from @/ui/animation/motion (Reanimated 4 spring defaults make partial configs wobble).',
  },
  {
    selector: "CallExpression[callee.name='withSpring'] > ObjectExpression",
    message:
      'Use a spring from springs.* in @/ui/animation/motion (complete, tested config). Inline partial configs inherit mass 4 and bounce.',
  },
];

module.exports = { animationRestrictions, springRestrictions };
