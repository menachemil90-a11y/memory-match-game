import { i18n, initI18n, isolate } from '../index';
import en from '../locales/en';

const FSI = '⁨';
const PDI = '⁩';
const LRM = '\u200E';

/** All strings of a nested translation object. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

describe('names in sentences (bidi)', () => {
  beforeAll(() => {
    initI18n();
  });

  it('every {{name}} placeholder uses the isolate formatter', () => {
    const offenders = strings(en).filter((s) => /\{\{\s*name\s*\}\}/.test(s));
    expect(offenders).toEqual([]);
    expect(strings(en).filter((s) => s.includes('{{name, isolate}}')).length).toBeGreaterThan(10);
  });

  it('isolates a Hebrew name so the English punctuation around it stays in place', () => {
    expect(i18n.t('myBoards.deleteBoardTitle', { name: 'משפחה' })).toBe(
      `Delete "${FSI}משפחה${PDI}"?`,
    );
    // A sentence that starts with the name: an LRM keeps it left to right (web dir="auto").
    expect(i18n.t('game.yourTurn', { name: 'נועה' })).toBe(`${LRM}${FSI}נועה${PDI}'s turn!`);
  });

  it('keeps the name itself unchanged (logical order, no reversal)', () => {
    expect(isolate('משפחה')).toBe(`${FSI}משפחה${PDI}`);
    expect(isolate('משפחה').slice(1, -1)).toBe('משפחה');
  });
});
