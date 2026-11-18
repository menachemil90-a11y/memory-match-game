import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  NotEnoughPhotosError,
  sanitizeBoardName,
  useCustomBoards,
  type ImportProgress,
} from '@/features/boards/custom/customBoardsStore';
import { pickFromGallery, takePhoto } from '@/features/boards/custom/photoPicker';
import { LowStorageError } from '@/features/boards/custom/photoStorage';
import { MAX_BOARD_NAME_LENGTH } from '@/features/boards/custom/types';
import { MAX_BOARD_IMAGES, MIN_BOARD_IMAGES } from '@/game';
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

/**
 * New photo board: name + chosen photos first, then "Create board" saves the
 * board and its photos together. A board is never saved with fewer than
 * MIN_BOARD_IMAGES photos (the store enforces it too).
 */
export default function NewBoardScreen() {
  const { t } = useTranslation();
  const createBoard = useCustomBoards((s) => s.createBoard);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  /** Where to go after the message is acknowledged (e.g. "2 photos could not be added"). */
  const [then, setThen] = useState<(() => void) | null>(null);

  const missing = Math.max(0, MIN_BOARD_IMAGES - chosen.length);

  const acknowledge = () => {
    setMessage(null);
    const next = then;
    setThen(null);
    next?.();
  };
  const room = MAX_BOARD_IMAGES - chosen.length;

  const choose = async (source: 'gallery' | 'camera') => {
    if (room <= 0) {
      setMessage(t('myBoards.maxReached', { max: MAX_BOARD_IMAGES }));
      return;
    }
    const picked = source === 'camera' ? await takePhoto() : await pickFromGallery(room);
    if (picked.status === 'denied') setMessage(t('myBoards.cameraDenied'));
    if (picked.status !== 'picked') return;
    setChosen((prev) =>
      [...prev, ...picked.uris.filter((u) => !prev.includes(u))].slice(0, MAX_BOARD_IMAGES),
    );
  };

  const create = async () => {
    const clean = sanitizeBoardName(name);
    if (!clean) {
      setNameError(true);
      return;
    }
    if (missing > 0) return;
    setProgress({ done: 0, total: chosen.length });
    try {
      const { boardId, addedIds, failed } = await createBoard(clean, chosen, setProgress);
      setProgress(null);
      // The new board opens in the crop queue; "Done" there leads to its editor.
      const open = () =>
        router.replace({
          pathname: '/my-boards/crop',
          params: { boardId, ids: addedIds.join(',') },
        });
      if (failed > 0) {
        setMessage(t('myBoards.importFailed', { count: failed }));
        setThen(() => open);
      } else {
        open();
      }
    } catch (error) {
      setProgress(null);
      if (error instanceof NotEnoughPhotosError) {
        setMessage(t('myBoards.notEnoughAdded', { count: error.added, min: MIN_BOARD_IMAGES }));
      } else if (error instanceof LowStorageError) {
        setMessage(t('myBoards.lowStorage'));
      } else {
        console.error('Creating a board failed', error);
        setMessage(t('myBoards.saveFailed'));
      }
    }
  };

  return (
    <Screen title={t('myBoards.newTitle')} scroll>
      <View style={styles.card}>
        <AppText variant="bodyStrong">{t('myBoards.nameLabel')}</AppText>
        <TextInput
          value={name}
          onChangeText={(v) => {
            setName(v);
            setNameError(false);
          }}
          placeholder={t('myBoards.namePlaceholder')}
          placeholderTextColor={colors.textMuted}
          maxLength={MAX_BOARD_NAME_LENGTH}
          autoFocus
          autoCapitalize="sentences"
          returnKeyType="done"
          accessibilityLabel={t('myBoards.nameLabel')}
          style={[styles.input, nameError && styles.inputError]}
        />
        {nameError ? (
          <AppText variant="caption" color={palette.coralDark}>
            {t('myBoards.nameRequired')}
          </AppText>
        ) : null}
      </View>

      <View style={[styles.card, styles.gap]}>
        <View style={styles.rowBetween}>
          <AppText variant="bodyStrong">{t('myBoards.chosen', { count: chosen.length })}</AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {chosen.length}/{MAX_BOARD_IMAGES}
          </AppText>
        </View>
        <AppText variant="body" color={missing > 0 ? colors.textMuted : palette.mintDark}>
          {missing > 0
            ? t('myBoards.chooseAtLeast', { count: missing })
            : t('myBoards.readyToCreate')}
        </AppText>
        {chosen.length > 0 ? (
          <View style={styles.grid}>
            {chosen.map((uri, i) => (
              <View key={uri} style={styles.thumb}>
                <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                <Pressable
                  onPress={() => setChosen((prev) => prev.filter((u) => u !== uri))}
                  accessibilityRole="button"
                  accessibilityLabel={t('myBoards.removeChosen', { n: i + 1 })}
                  hitSlop={10}
                  style={styles.remove}
                >
                  <Ionicons name="close" size={16} color={colors.textOnDark} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        <GameButton
          label={t('myBoards.addFromGallery')}
          icon="images"
          size="md"
          onPress={() => void choose('gallery')}
        />
        <GameButton
          label={t('myBoards.takePhoto')}
          icon="camera"
          variant="info"
          size="md"
          onPress={() => void choose('camera')}
        />
      </View>

      <GameButton
        label={t('myBoards.createBoard')}
        icon="checkmark"
        variant="success"
        disabled={missing > 0 || progress !== null}
        onPress={() => void create()}
        style={styles.create}
        testID="create-board"
      />

      <ProgressOverlay
        visible={progress !== null}
        label={
          progress ? t('myBoards.preparing', { done: progress.done, total: progress.total }) : ''
        }
        progress={progress ? progress.done / Math.max(1, progress.total) : null}
      />
      <Dialog visible={message !== null} title={message ?? ''} onRequestClose={acknowledge}>
        <GameButton label={t('common.ok')} size="md" onPress={acknowledge} />
      </Dialog>
    </Screen>
  );
}

const THUMB = 64;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    boxShadow: shadows.md,
  },
  gap: { marginTop: spacing.lg, gap: spacing.md },
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
  inputError: { borderColor: palette.coral },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: colors.card.border,
    backgroundColor: palette.cloud,
    overflow: 'hidden',
  },
  remove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  create: { marginTop: spacing.xl, marginBottom: spacing.lg },
});
