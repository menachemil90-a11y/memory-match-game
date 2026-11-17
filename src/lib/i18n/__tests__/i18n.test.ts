import { initI18n } from '..';
import en from '../locales/en';

function leaves(obj: object, prefix = ''): [string, unknown][] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? leaves(value as object, `${prefix}${key}.`)
      : [[`${prefix}${key}`, value] as [string, unknown]],
  );
}

describe('i18n', () => {
  it('has a non-empty string for every English key', () => {
    for (const [key, value] of leaves(en)) {
      expect({ key, ok: typeof value === 'string' && value.length > 0 }).toEqual({ key, ok: true });
    }
  });

  it('translates and interpolates synchronously after init', () => {
    const i18n = initI18n();
    expect(i18n.t('home.solo')).toBe('Solo');
    expect(i18n.t('online.room', { code: 'ABC234' })).toBe('Room ABC234');
  });
});
