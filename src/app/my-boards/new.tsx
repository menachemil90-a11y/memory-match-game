import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { sanitizeBoardName, useCustomBoards } from '@/features/boards/custom/customBoardsStore';
import { MAX_BOARD_NAME_LENGTH } from '@/features/boards/custom/types';
import { useAddPhotos } from '@/features/boards/custom/useAddPhotos';
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

export default function NewBoardScreen() {
  const { t } = useTranslation();
  const createBoard = useCustomBoards((s) => s.createBoard);
  const deleteBoard = useCustomBoards((s) => s.deleteBoard);
  const add = useAddPhotos();
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState(false);
  const [boardId, setBoardId] = useState<string | null>(null);

  const start = async (source: 'gallery' | 'camera') => {
    const clean = sanitizeBoardName(name);
    if (!clean) {
      setNameError(true);
      return;
    }
    const id = boardId ?? (await createBoard(clean));
    setBoardId(id);
    const added = await add.run(id, 0, source, { replace: true });
    if (!added && !boardId) {
      // Nothing was added to a brand-new board: don't leave an empty board behind.
      await deleteBoard(id);
      setBoardId(null);
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
        <AppText variant="body" color={colors.textMuted}>
          {t('myBoards.photosHint', { max: MAX_BOARD_IMAGES, min: MIN_BOARD_IMAGES })}
        </AppText>
      </View>
      <View style={styles.actions}>
        <GameButton
          label={t('myBoards.addFromGallery')}
          icon="images"
          onPress={() => void start('gallery')}
        />
        <GameButton
          label={t('myBoards.takePhoto')}
          icon="camera"
          variant="info"
          onPress={() => void start('camera')}
        />
      </View>
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    boxShadow: shadows.md,
  },
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
  actions: { gap: spacing.lg, marginTop: spacing.xl },
});
