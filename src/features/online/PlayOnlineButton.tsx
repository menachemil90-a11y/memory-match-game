import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { usePlayersStore } from '@/features/players/playersStore';
import { Dialog, GameButton } from '@/ui/components';

import { OnlineProfileCard } from './components/OnlineProfileCard';
import { isOnlineConfigured } from './config';
import { checkNickname } from './nickname';

/**
 * "Play online" for one board (board editor): goes straight to choosing the
 * level of a new online game with this board — from there the usual flow
 * (photo consent, upload, invite link). If the player has no valid online name
 * yet, it asks for name + avatar first, like the online lobby does.
 */
export function PlayOnlineButton({ boardId, disabled }: { boardId: string; disabled?: boolean }) {
  const { t } = useTranslation();
  const name = usePlayersStore((s) => s.online.name);
  const [askName, setAskName] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  if (!isOnlineConfigured) return null;

  const open = () => router.push({ pathname: '/online/new', params: { boardId } });

  return (
    <>
      <GameButton
        label={t('myBoards.playOnline')}
        icon="globe"
        variant="info"
        disabled={disabled}
        testID="play-online"
        onPress={() => {
          if (checkNickname(name).ok) open();
          else setAskName(true);
        }}
      />
      <Dialog
        visible={askName}
        title={t('myBoards.onlineNameTitle')}
        onRequestClose={() => setAskName(false)}
      >
        <OnlineProfileCard showErrors={showErrors} />
        <GameButton
          label={t('common.continue')}
          size="md"
          testID="play-online-continue"
          onPress={() => {
            const ok = checkNickname(name).ok;
            setShowErrors(!ok);
            if (!ok) return;
            setAskName(false);
            open();
          }}
        />
        <GameButton
          label={t('common.cancel')}
          variant="secondary"
          size="md"
          onPress={() => setAskName(false)}
        />
      </Dialog>
    </>
  );
}
