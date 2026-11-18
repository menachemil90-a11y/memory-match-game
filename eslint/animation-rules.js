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

module.exports = { animationRestrictions };
