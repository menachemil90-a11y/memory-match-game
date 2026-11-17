import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useBoard, useBoardName } from '@/features/boards/useBoard';
import { bestScoresRepo } from '@/features/game/bestScoresRepo';
import type { GameMode } from '@/features/game/gameSessionStore';
import { startGame } from '@/features/game/startGame';
import { usePlayersStore } from '@/features/players/playersStore';
import { getLevelAvailability, type LevelId, type SoloScore } from '@/game';
import { getDb } from '@/lib/db';
import { AppText, Dialog, GameButton, Screen } from '@/ui/components';
import { colors, radii, spacing } from '@/ui/theme';
import { LevelTile } from '@/features/levels/LevelTile';

export default function LevelPickerScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ mode?: string; boardId?: string }>();
  const mode: GameMode = params.mode === 'local' ? 'local' : 'solo';
  const board = useBoard(params.boardId);
  const boardName = useBoardName(board);
  const [best, setBest] = useState<Partial<Record<LevelId, SoloScore>>>({});
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!board || mode !== 'solo') return;
      let active = true;
      void getDb()
        .then((db) => bestScoresRepo.forBoard(db, board.id))
        .then((scores) => active && setBest(scores))
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, [board, mode]),
  );

  if (!board) {
    return (
      <Screen title={t('levels.title')}>
        <AppText variant="heading" color={colors.textOnDark} align="center">
          {t('boards.notFound')}
        </AppText>
      </Screen>
    );
  }

  const cover = board.images.find((i) => i.id === board.coverImageId) ?? board.images[0];

  const choose = async (levelId: LevelId) => {
    if (busy) return;
    if (mode === 'local') {
      router.push({ pathname: '/setup', params: { boardId: board.id, levelId } });
      return;
    }
    setBusy(true);
    try {
      const { local } = usePlayersStore.getState();
      await startGame({
        mode: 'solo',
        board,
        levelId,
        players: [{ ...local[0], name: '' }],
        tabletop: false,
      });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={t('levels.title')} scroll>
      <View style={styles.boardRow}>
        {cover ? (
          <View
            style={[
              styles.cover,
              { backgroundColor: cover.kind === 'art' ? cover.background : colors.surface },
            ]}
          >
            <Image
              source={cover.source}
              style={cover.kind === 'art' ? styles.coverArt : StyleSheet.absoluteFill}
              contentFit={cover.kind === 'art' ? 'contain' : 'cover'}
            />
          </View>
        ) : null}
        <View style={styles.boardText}>
          <AppText variant="title" color={colors.textOnDark} numberOfLines={1}>
            {boardName}
          </AppText>
          <AppText variant="body" color={colors.textOnDarkMuted}>
            {board.kind === 'custom'
              ? t('boards.photos', { count: board.images.length })
              : t('boards.images', { count: board.images.length })}
          </AppText>
        </View>
      </View>
      <View style={styles.grid}>
        {getLevelAvailability(board.images.length).map((a) => (
          <LevelTile
            key={a.level.id}
            availability={a}
            best={best[a.level.id]}
            showBest={mode === 'solo'}
            onPress={() => void choose(a.level.id)}
          />
        ))}
      </View>
      <Dialog visible={error} title={t('game.loadError')} onRequestClose={() => setError(false)}>
        <GameButton label={t('common.ok')} size="md" onPress={() => setError(false)} />
      </Dialog>
    </Screen>
  );
}

const styles = StyleSheet.create({
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  cover: {
    width: 76,
    height: 76,
    borderRadius: radii.lg,
    borderWidth: 4,
    borderColor: colors.card.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coverArt: { width: 50, height: 50 },
  boardText: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
