import { useTranslation } from 'react-i18next';

import { ProfileCard } from '@/features/players/components/ProfileCard';
import { usePlayersStore } from '@/features/players/playersStore';

import { MAX_NICKNAME_LENGTH, checkNickname } from '../nickname';

/** Nickname + preset avatar for online play (remembered on the device). */
export function OnlineProfileCard({ showErrors }: { showErrors: boolean }) {
  const { t } = useTranslation();
  const online = usePlayersStore((s) => s.online);
  const setOnline = usePlayersStore((s) => s.setOnline);
  const check = checkNickname(online.name);
  const error = showErrors && !check.ok;

  return (
    <ProfileCard
      title={t('online.youAre')}
      name={online.name}
      avatar={online.avatar}
      onChangeName={(name) => setOnline({ ...online, name })}
      onChangeAvatar={(avatar) => setOnline({ ...online, avatar })}
      placeholder={t('online.nicknamePlaceholder')}
      maxLength={MAX_NICKNAME_LENGTH}
      nameLabel={t('online.youAre')}
      hint={{
        text: error && !check.ok ? t(`online.nickname.${check.reason}`) : t('online.nicknameHint'),
        error,
      }}
    />
  );
}
