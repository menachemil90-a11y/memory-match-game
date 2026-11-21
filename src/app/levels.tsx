import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BoardsLoadError } from '@/features/boards/components/BoardsLoadError';
import { CUSTOM_BOARD_PREFIX } from '@/features/boards/custom/types';
import { useBoard, useBoardName, useCustomBoardsStatus } from '@/features/boards/useBoard';
import { bestScoresRepo } from '@/features/game/bestScoresRepo';
import type { GameMode } from '@/features/game/gameSessionStore';
import { startGame } from '@/features/game/startGame';
import { AVATAR_SOURCES } from '@/features/boards/builtin';
import { playerColor, usePlayersStore } from '@/features/players/playersStore';
import {
  getLevelAvailability,
  isLevelAllowedForPlayers,
  maxPlayersForLevel,
  MIN_BOARD_IMAGES,
  smallestLevelForPlayers,
  type LevelAvailability,
  type LevelId,
  type SoloScore,
} from '@/game';
import { getDb } from '@/lib/db';
import { AppText, Dialog, GameButton, IconButton, Screen } from '@/ui/components';
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
  const [locked, setLocked] = useState<LevelAvailability | null>(null);
  const [tooSmall, setTooSmall] = useState<LevelId | null>(null);
  const customStatus = useCustomBoardsStatus();
  /** Players on this phone (2–8 players: smaller boards don't give everyone turns). */
  const group = usePlayersStore((s) => s.local);
  const groupSize = mode === 'local' ? group.length : 1;

  useFocusEffect(
    useCallback(() => {
      if (!board || mode !== 'solo') return;
      let active = true;
      void getDb()
        .then((db) => bestScoresRepo.forBoard(db, board.id))
        .then((scores) => active && setBest(scores))
        // Best stars are decoration: the levels stay playable; the error is logged.
        .catch((e: unknown) => console.error('Loading best scores failed', e));
      return () => {
        active = false;
      };
    }, [board, mode]),
  );

  if (!board) {
    const isCustom = params.boardId?.startsWith(CUSTOM_BOARD_PREFIX) ?? false;
    return (
      <Screen title={t('levels.title')}>
        {isCustom && customStatus === 'failed' ? (
          <BoardsLoadError />
        ) : (
          <View style={styles.notFound}>
            <AppText variant="heading" color={colors.textOnDark} align="center">
              {isCustom && customStatus !== 'ready' ? t('common.loading') : t('boards.notFound')}
            </AppText>
            <GameButton
              label={t('common.back')}
              icon="arrow-back"
              variant="secondary"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            />
          </View>
        )}
      </Screen>
    );
  }

  const isCustom = board.kind === 'custom';
  const openEditor = (addPhotos: boolean) =>
    router.push({
      pathname: '/my-boards/[boardId]',
      params: addPhotos ? { boardId: board.id, add: '1' } : { boardId: board.id },
    });
  const tooFew = isCustom && board.images.length < MIN_BOARD_IMAGES;

  const cover = board.images.find((i) => i.id === board.coverImageId) ?? board.images[0];

  const choose = async (availability: LevelAvailability) => {
    const levelId = availability.level.id;
    if (busy) return;
    if (availability.locked) {
      setLocked(availability);
      return;
    }
    if (!isLevelAllowedForPlayers(levelId, groupSize)) {
      setTooSmall(levelId);
      return;
    }
    setBusy(true);
    try {
      const { local, tabletop } = usePlayersStore.getState();
      await startGame(
        mode === 'local'
          ? { mode, board, levelId, players: local, tabletop: local.length === 2 && tabletop }
          : { mode, board, levelId, players: [{ ...local[0]!, name: '' }], tabletop: false },
      );
    } catch (e) {
      console.error('Starting a game failed', e);
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
      {tooFew ? (
        <View style={styles.notice} accessibilityRole="alert">
          <AppText variant="bodyStrong">{t('myBoards.tooFewTitle')}</AppText>
          <AppText variant="body" color={colors.textMuted}>
            {t('myBoards.notEnoughToPlay', { count: MIN_BOARD_IMAGES - board.images.length })}
          </AppText>
          <GameButton
            label={t('levels.addPhotos')}
            icon="add"
            variant="success"
            size="md"
            onPress={() => openEditor(true)}
          />
        </View>
      ) : null}
      {mode === 'local' ? (
        <View style={styles.groupRow}>
          <View style={styles.groupAvatars} accessible={false}>
            {group.map((p, i) => (
              <View
                key={p.color}
                style={[
                  styles.groupAvatar,
                  {
                    backgroundColor: playerColor(p.color).main,
                    marginLeft: i === 0 ? 0 : group.length > 4 ? -18 : -12,
                  },
                ]}
              >
                <Image source={AVATAR_SOURCES[p.avatar]} style={styles.groupAvatarImage} />
              </View>
            ))}
          </View>
          <AppText variant="bodyStrong" color={colors.textOnDark} style={styles.flex}>
            {t('levels.players', { count: groupSize })}
          </AppText>
          <IconButton
            icon="create-outline"
            accessibilityLabel={t('levels.changePlayers')}
            onPress={() => router.dismissTo('/setup')}
          />
        </View>
      ) : null}
      {isCustom ? (
        <GameButton
          label={t('levels.editBoard')}
          icon="pencil"
          variant="secondary"
          size="md"
          onPress={() => openEditor(false)}
          style={styles.edit}
        />
      ) : null}
      <View style={styles.grid}>
        {getLevelAvailability(board.images.length).map((a) => (
          <LevelTile
            key={a.level.id}
            availability={a}
            best={best[a.level.id]}
            showBest={mode === 'solo'}
            tooSmallFor={
              isLevelAllowedForPlayers(a.level.id, groupSize)
                ? null
                : maxPlayersForLevel(a.level.id)
            }
            onPress={() => void choose(a)}
          />
        ))}
      </View>
      <Dialog
        visible={locked !== null}
        title={
          locked
            ? t('levels.lockedTitle', {
                level: t(`levels.names.${locked.level.id}`),
                pairs: locked.level.pairs,
              })
            : ''
        }
        message={
          locked
            ? t('levels.lockedMessage', {
                have: board.images.length,
                count: locked.missingImages,
                level: t(`levels.names.${locked.level.id}`),
              })
            : undefined
        }
        onRequestClose={() => setLocked(null)}
      >
        {isCustom ? (
          <GameButton
            label={t('levels.addPhotos')}
            icon="add"
            variant="success"
            size="md"
            onPress={() => {
              setLocked(null);
              openEditor(true);
            }}
          />
        ) : null}
        <GameButton
          label={t('common.cancel')}
          variant="secondary"
          size="md"
          onPress={() => setLocked(null)}
        />
      </Dialog>
      <Dialog
        visible={tooSmall !== null}
        title={
          tooSmall
            ? t('levels.tooSmallTitle', { level: t(`levels.names.${tooSmall}`), count: groupSize })
            : ''
        }
        message={t('levels.tooSmallMessage', {
          count: groupSize,
          smallest: t(`levels.names.${smallestLevelForPlayers(groupSize).id}`),
        })}
        onRequestClose={() => setTooSmall(null)}
      >
        <GameButton
          label={t('levels.changePlayers')}
          icon="people"
          variant="info"
          size="md"
          onPress={() => {
            setTooSmall(null);
            router.dismissTo('/setup');
          }}
        />
        <GameButton
          label={t('common.cancel')}
          variant="secondary"
          size="md"
          onPress={() => setTooSmall(null)}
        />
      </Dialog>
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
  notFound: { gap: spacing.lg },
  notice: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  edit: { marginBottom: spacing.lg },
  flex: { flex: 1 },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  groupAvatars: { flexDirection: 'row', flexShrink: 1 },
  groupAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.card.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupAvatarImage: { width: 24, height: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
