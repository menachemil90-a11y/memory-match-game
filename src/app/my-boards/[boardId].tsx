import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CARD_BACK_IDS, CARD_BACK_SOURCES } from '@/features/boards/builtin';
import { thumbUri, useCustomBoards } from '@/features/boards/custom/customBoardsStore';
import { MAX_BOARD_NAME_LENGTH, type PhotoRecord } from '@/features/boards/custom/types';
import { useAddPhotos } from '@/features/boards/custom/useAddPhotos';
import { useCustomBoardsLoaded } from '@/features/boards/useBoard';
import { MAX_BOARD_IMAGES, MIN_BOARD_IMAGES, nextLockedLevel } from '@/game';
import { feedback } from '@/lib/feedback';
import { AppText, Dialog, GameButton, ProgressOverlay, Screen } from '@/ui/components';
import {
  colors,
  fonts,
  minTouchTarget,
  palette,
  radii,
  shadows,
  spacing,
  typography,
} from '@/ui/theme';

const COLUMNS = 4;

function NameField({ initial, onSave }: { initial: string; onSave: (name: string) => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial);
  return (
    <TextInput
      value={name}
      onChangeText={setName}
      onEndEditing={() => onSave(name)}
      maxLength={MAX_BOARD_NAME_LENGTH}
      accessibilityLabel={t('myBoards.nameLabel')}
      returnKeyType="done"
      style={styles.input}
    />
  );
}

export default function BoardEditorScreen() {
  const { t } = useTranslation();
  const { boardId = '' } = useLocalSearchParams<{ boardId?: string }>();
  const loaded = useCustomBoardsLoaded();
  const board = useCustomBoards((s) => s.boards.find((b) => b.id === boardId));
  const missingIds = useCustomBoards((s) => s.missing[boardId] ?? []);
  const store = useCustomBoards();
  const add = useAddPhotos();
  const { width } = useWindowDimensions();
  const [selected, setSelected] = useState<PhotoRecord | null>(null);
  const [confirmDeletePhoto, setConfirmDeletePhoto] = useState<PhotoRecord | null>(null);
  const [confirmDeleteBoard, setConfirmDeleteBoard] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  if (!board) {
    return (
      <Screen title={t('myBoards.editorTitle')}>
        <AppText variant="heading" color={colors.textOnDark} align="center">
          {loaded ? t('boards.notFound') : t('common.loading')}
        </AppText>
      </Screen>
    );
  }

  const photos = board.photos;
  const playable = photos.filter((p) => !missingIds.includes(p.id));
  const tile = Math.floor(
    (Math.min(width, 640) - spacing.lg * 2 - spacing.sm * (COLUMNS - 1)) / COLUMNS,
  );
  const nextLock = nextLockedLevel(playable.length);
  const coverId = board.coverPhotoId ?? photos[0]?.id;

  const unlockText = () => {
    if (playable.length < MIN_BOARD_IMAGES) {
      return t('myBoards.notEnoughToPlay', { count: MIN_BOARD_IMAGES - playable.length });
    }
    if (!nextLock) return t('myBoards.allUnlocked');
    return t('levels.unlockHint', {
      count: nextLock.missingImages,
      level: t(`levels.names.${nextLock.level.id}`),
    });
  };

  const act = (fn: () => Promise<void>) => {
    setSelected(null);
    void fn().catch(() => undefined);
  };

  return (
    <Screen title={t('myBoards.editorTitle')} scroll>
      <View style={styles.section}>
        <AppText variant="bodyStrong">{t('myBoards.nameLabel')}</AppText>
        <NameField
          key={board.id}
          initial={board.name}
          onSave={(n) => void store.rename(board.id, n)}
        />
      </View>

      {missingIds.length > 0 ? (
        <View style={[styles.section, styles.warning]}>
          <AppText variant="bodyStrong">
            {t('myBoards.missingTitle', { count: missingIds.length })}
          </AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {t('myBoards.missingMessage')}
          </AppText>
          <GameButton
            label={t('myBoards.removeMissing')}
            variant="danger"
            size="md"
            onPress={() =>
              act(async () => {
                for (const p of photos.filter((ph) => missingIds.includes(ph.id))) {
                  await store.deletePhoto(p);
                }
              })
            }
          />
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.rowBetween}>
          <AppText variant="bodyStrong">{t('myBoards.photos', { count: photos.length })}</AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {photos.length}/{MAX_BOARD_IMAGES}
          </AppText>
        </View>
        <View style={[styles.hint, !nextLock && styles.hintDone]}>
          <Ionicons
            name={nextLock ? 'lock-open-outline' : 'trophy'}
            size={18}
            color={nextLock ? palette.grape : palette.mintDark}
          />
          <AppText variant="caption" color={colors.text} style={styles.flex}>
            {unlockText()}
          </AppText>
        </View>
        <View style={styles.grid}>
          {photos.map((photo, i) => {
            const missing = missingIds.includes(photo.id);
            return (
              <Pressable
                key={photo.id}
                onPress={() => {
                  feedback.tap();
                  setSelected(photo);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${t('myBoards.photoLabel', { n: i + 1 })}${photo.id === coverId ? `, ${t('myBoards.cover')}` : ''}`}
                style={[styles.thumb, { width: tile, height: tile }]}
              >
                {missing ? (
                  <Ionicons name="alert-circle" size={28} color={palette.coral} />
                ) : (
                  <Image
                    source={{ uri: thumbUri(photo) }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={120}
                  />
                )}
                {photo.id === coverId ? (
                  <View style={styles.coverBadge}>
                    <Ionicons name="star" size={12} color={palette.sunInk} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
          {photos.length < MAX_BOARD_IMAGES ? (
            <Pressable
              onPress={() => setAddOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t('myBoards.addPhotos')}
              style={[styles.thumb, styles.addTile, { width: tile, height: tile }]}
            >
              <Ionicons name="add" size={32} color={palette.grape} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <AppText variant="bodyStrong">{t('myBoards.cardBack')}</AppText>
        <View style={styles.backs}>
          {CARD_BACK_IDS.map((id, i) => {
            const active = id === board.cardBack;
            return (
              <Pressable
                key={id}
                onPress={() => {
                  feedback.tap();
                  void store.setCardBack(board.id, id);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={t('myBoards.a11yCardBack', { n: i + 1 })}
                style={[styles.back, active && styles.backActive]}
              >
                <Image
                  source={CARD_BACK_SOURCES[id]}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.play}>
        <GameButton
          label={t('myBoards.playSolo')}
          icon="person"
          disabled={playable.length < MIN_BOARD_IMAGES}
          onPress={() =>
            router.push({ pathname: '/levels', params: { mode: 'solo', boardId: board.id } })
          }
        />
        <GameButton
          label={t('myBoards.playTwo')}
          icon="people"
          variant="danger"
          disabled={playable.length < MIN_BOARD_IMAGES}
          onPress={() =>
            router.push({ pathname: '/levels', params: { mode: 'local', boardId: board.id } })
          }
        />
        <GameButton
          label={t('myBoards.deleteBoard')}
          icon="trash"
          variant="secondary"
          size="md"
          onPress={() => setConfirmDeleteBoard(true)}
        />
      </View>

      {/* Photo actions */}
      <Dialog
        visible={selected !== null}
        title={selected ? t('myBoards.photoActions', { n: photos.indexOf(selected) + 1 }) : ''}
        onRequestClose={() => setSelected(null)}
      >
        {selected && !missingIds.includes(selected.id) ? (
          <>
            <GameButton
              label={t('myBoards.recrop')}
              icon="crop"
              size="md"
              onPress={() => {
                const p = selected;
                setSelected(null);
                router.push({
                  pathname: '/my-boards/crop',
                  params: { boardId: board.id, ids: p.id, returnTo: 'back' },
                });
              }}
            />
            <GameButton
              label={t('myBoards.makeCover')}
              icon="star"
              variant="info"
              size="md"
              onPress={() => act(() => store.setCover(board.id, selected.id))}
            />
          </>
        ) : null}
        {selected && photos.indexOf(selected) > 0 ? (
          <GameButton
            label={t('myBoards.moveEarlier')}
            icon="arrow-back"
            variant="secondary"
            size="md"
            onPress={() => act(() => store.movePhoto(board.id, selected.id, -1))}
          />
        ) : null}
        {selected && photos.indexOf(selected) < photos.length - 1 ? (
          <GameButton
            label={t('myBoards.moveLater')}
            icon="arrow-forward"
            variant="secondary"
            size="md"
            onPress={() => act(() => store.movePhoto(board.id, selected.id, 1))}
          />
        ) : null}
        <GameButton
          label={t('myBoards.deletePhoto')}
          icon="trash"
          variant="danger"
          size="md"
          onPress={() => {
            setConfirmDeletePhoto(selected);
            setSelected(null);
          }}
        />
      </Dialog>

      <Dialog
        visible={confirmDeletePhoto !== null}
        title={t('myBoards.deletePhotoTitle')}
        onRequestClose={() => setConfirmDeletePhoto(null)}
      >
        <GameButton
          label={t('common.cancel')}
          variant="secondary"
          size="md"
          onPress={() => setConfirmDeletePhoto(null)}
        />
        <GameButton
          label={t('common.delete')}
          variant="danger"
          size="md"
          onPress={() => {
            const p = confirmDeletePhoto;
            setConfirmDeletePhoto(null);
            if (p) void store.deletePhoto(p);
          }}
        />
      </Dialog>

      <Dialog
        visible={confirmDeleteBoard}
        title={t('myBoards.deleteBoardTitle', { name: board.name })}
        message={t('myBoards.deleteBoardMessage')}
        onRequestClose={() => setConfirmDeleteBoard(false)}
      >
        <GameButton
          label={t('common.cancel')}
          variant="secondary"
          size="md"
          onPress={() => setConfirmDeleteBoard(false)}
        />
        <GameButton
          label={t('common.delete')}
          variant="danger"
          size="md"
          onPress={() => {
            setConfirmDeleteBoard(false);
            void store.deleteBoard(board.id).then(() => router.back());
          }}
        />
      </Dialog>

      <Dialog
        visible={addOpen}
        title={t('myBoards.addPhotos')}
        onRequestClose={() => setAddOpen(false)}
      >
        <GameButton
          label={t('myBoards.addFromGallery')}
          icon="images"
          size="md"
          onPress={() => {
            setAddOpen(false);
            void add.run(board.id, photos.length, 'gallery');
          }}
        />
        <GameButton
          label={t('myBoards.takePhoto')}
          icon="camera"
          variant="info"
          size="md"
          onPress={() => {
            setAddOpen(false);
            void add.run(board.id, photos.length, 'camera');
          }}
        />
      </Dialog>

      <ProgressOverlay
        visible={add.progress !== null}
        label={add.progressLabel}
        progress={add.progress ? add.progress.done / Math.max(1, add.progress.total) : null}
      />
      <Dialog
        visible={add.message !== null}
        title={add.message ?? ''}
        onRequestClose={add.clearMessage}
      >
        <GameButton label={t('common.ok')} size="md" onPress={add.clearMessage} />
      </Dialog>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
    boxShadow: shadows.md,
  },
  warning: { borderWidth: 3, borderColor: palette.coral },
  input: {
    ...typography.heading,
    fontFamily: fonts.semibold,
    color: colors.text,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: minTouchTarget,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.cloud,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  hintDone: { backgroundColor: '#E2F8EE' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumb: {
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: colors.card.border,
    backgroundColor: palette.cloud,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: shadows.sm,
  },
  addTile: { borderStyle: 'dashed', borderColor: palette.grapeLight },
  coverBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: palette.sun,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card.border,
  },
  backs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  back: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: colors.card.border,
  },
  backActive: { borderColor: palette.ink, transform: [{ scale: 1.08 }] },
  play: { gap: spacing.md, paddingBottom: spacing.lg },
});
