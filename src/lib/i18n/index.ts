import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en';

export const defaultNS = 'translation';

export const resources = {
  en: { [defaultNS]: en },
} as const;

/** Languages that ship in the app. Hebrew (RTL) will be added later. */
export const supportedLanguages = ['en'] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

let initialized = false;

export function initI18n(): typeof i18n {
  if (!initialized) {
    initialized = true;
    // eslint-disable-next-line import/no-named-as-default-member
    void i18n.use(initReactI18next).init({
      resources,
      lng: 'en',
      fallbackLng: 'en',
      defaultNS,
      interpolation: { escapeValue: false },
      returnNull: false,
      initAsync: false,
    });
  }
  return i18n;
}

export { i18n };
