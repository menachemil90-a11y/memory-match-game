/**
 * Lint guard for zustand selectors.
 *
 * zustand v5 re-renders whenever a selector's result is not `Object.is`-equal
 * to the previous one. A selector that builds a new array/object on every call
 * (`s.missing[id] ?? []`, `s.items.filter(…)`, `({ a: s.a })`) therefore makes
 * the component render forever ("Maximum update depth exceeded") — the board
 * editor freeze. Selectors must return values that already exist in the state
 * (or primitives). Derive inside the component, store data in a shape that
 * needs no defaults, or wrap the selector in `useShallow` from zustand/shallow.
 *
 * The store hook names live in zustand-store-hooks.json; a test fails when a
 * store is added to src/ without being listed there.
 */
const STORE_HOOKS = require('./zustand-store-hooks.json');

const hooks = `/^(${STORE_HOOKS.join('|')})$/`;
const selector = `CallExpression[callee.name=${hooks}] > :matches(ArrowFunctionExpression, FunctionExpression)`;

/** Array methods that return a new array/object, plus constructors of new collections. */
const NEW_VALUE_METHODS =
  'map|filter|slice|concat|flat|flatMap|toSorted|toReversed|toSpliced|with|reduce|reduceRight|split|entries|keys|values|fromEntries|from|of|assign';

const storeSelectorRestrictions = [
  {
    selector: `${selector} :matches(ArrayExpression, ObjectExpression, NewExpression)`,
    message:
      'Store selectors must not create arrays/objects (new value on every call → infinite re-render in zustand v5). Return state as stored, derive in the component, or use useShallow.',
  },
  {
    selector: `${selector} CallExpression[callee.property.name=/^(${NEW_VALUE_METHODS})$/]`,
    message:
      'Store selectors must not call methods that return new arrays/objects (map/filter/slice/…). Return state as stored, derive in the component (useMemo), or use useShallow.',
  },
];

module.exports = { STORE_HOOKS, storeSelectorRestrictions };
