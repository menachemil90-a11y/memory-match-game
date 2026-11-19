import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { toOnlineError } from './errors';

const KNOWN = [
  'update_required',
  'room_not_found',
  'room_full',
  'nickname_not_allowed',
  'invalid_nickname',
  'network',
  'photos_missing',
  'too_many_rooms',
  'not_available',
] as const;

/** Turns server/network errors into friendly messages. */
export function useOnlineError() {
  const { t } = useTranslation();
  const [message, setMessage] = useState<string | null>(null);
  return {
    message,
    clear: () => setMessage(null),
    show: (error: unknown) => {
      const code = toOnlineError(error).code;
      const known = KNOWN.find((k) => k === code);
      setMessage(known ? t(`online.errors.${known}`) : t('online.errors.unknown'));
    },
  };
}
