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

/** Unicode First Strong Isolate / Pop Directional Isolate. */
const FSI = '\u2068';
const PDI = '\u2069';

/**
 * Wraps text the user typed (board and player names) in a bidi isolate, so a
 * Hebrew/Arabic name inside an English sentence keeps its own direction and
 * can't reorder the punctuation or words around it ("Delete "משפחה"?").
 * Every `{{name}}` in the translations must use `{{name, isolate}}` (tested).
 */
export function isolate(text: string): string {
  return `${FSI}${text}${PDI}`;
}

/** Unicode Left-to-Right Mark (invisible). */
const LRM = '\u200E';

/**
 * The UI sentences are English (left to right). One that starts with a name
 * ("נועה's turn!") would otherwise be laid out right to left on the web: there
 * text gets dir="auto", which takes the paragraph direction from the first
 * strong letter — the name's, even inside an isolate. An invisible LRM in
 * front keeps the sentence LTR everywhere.
 */
export function ltrSentence(text: string): string {
  return text.startsWith(FSI) ? `${LRM}${text}` : text;
}

export function initI18n(): typeof i18n {
  if (!initialized) {
    initialized = true;
    // eslint-disable-next-line import/no-named-as-default-member
    void i18n
      .use(initReactI18next)
      .use({ type: 'postProcessor', name: 'ltrSentence', process: ltrSentence })
      .init({
        resources,
        lng: 'en',
        fallbackLng: 'en',
        defaultNS,
        interpolation: { escapeValue: false },
        returnNull: false,
        initAsync: false,
        postProcess: ['ltrSentence'],
      });
    i18n.services.formatter?.add('isolate', (value: unknown) => isolate(String(value)));
  }
  return i18n;
}

export { i18n };
