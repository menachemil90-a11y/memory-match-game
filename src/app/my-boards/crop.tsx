import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Cropper, cardFrame, type CropperHandle } from '@/features/boards/custom/Cropper';
import type { CropParams } from '@/features/boards/custom/cropMath';
import { sourceUri, useCustomBoards } from '@/features/boards/custom/customBoardsStore';
import { AppText, Dialog, GameButton, IconButton, Screen } from '@/ui/components';
import { colors, spacing } from '@/ui/theme';

function changed(a: CropParams, b: CropParams): boolean {
  return (
    a.rotation !== b.rotation ||
    Math.abs(a.originX - b.originX) > 0.5 ||
    Math.abs(a.originY - b.originY) > 0.5 ||
    Math.abs(a.size - b.size) > 0.5
  );
}

/**
 * Batch crop queue ("Photo 3 of 12"). Every photo already has an automatic
 * centered crop, so "Done all" is always safe.
 */
export default function CropQueueScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ boardId?: string; ids?: string; returnTo?: string }>();
  const ids = (params.ids ?? '').split(',').filter(Boolean);
  const board = useCustomBoards((s) => s.boards.find((b) => b.id === params.boardId));
  const saveCrop = useCustomBoards((s) => s.saveCrop);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const cropper = useRef<CropperHandle>(null);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const photos = ids
    .map((id) => board?.photos.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined);
  const photo = photos[Math.min(index, photos.length - 1)];

  const finish = () => {
    if (params.returnTo === 'back' && router.canGoBack()) router.back();
    else if (params.boardId) router.replace(`/my-boards/${params.boardId}`);
    else router.back();
  };

  if (!board || !photo) {
    return (
      <Screen title={t('myBoards.cropTitle')}>
        <GameButton label={t('common.done')} onPress={finish} />
      </Screen>
    );
  }

  const saveCurrent = async () => {
    const crop = cropper.current?.getCrop();
    if (crop && changed(crop, photo.crop)) await saveCrop(photo, crop);
  };

  const go = async (all: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      await saveCurrent();
      if (all || index >= photos.length - 1) finish();
      else setIndex(index + 1);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const areaWidth = width - insets.left - insets.right;
  const available = height - insets.top - insets.bottom - 330;
  const frame = cardFrame(Math.min(areaWidth - 64, available));
  const viewport = Math.max(160, Math.min(areaWidth - 64, available) - frame.border * 2);
  const isLast = index >= photos.length - 1;

  return (
    <Screen title={t('myBoards.cropTitle')}>
      <View style={styles.body}>
        <AppText
          variant="heading"
          color={colors.textOnDark}
          align="center"
          accessibilityLiveRegion="polite"
        >
          {t('myBoards.photoOf', { n: index + 1, total: photos.length })}
        </AppText>
        <View style={styles.cropperBleed}>
          <Cropper
            key={photo.id}
            uri={sourceUri(photo)}
            sourceSize={{ width: photo.sourceWidth, height: photo.sourceHeight }}
            initialCrop={photo.crop}
            viewport={viewport}
            areaWidth={areaWidth}
            previewSize={56}
            handleRef={cropper}
          />
        </View>
        <AppText variant="caption" color={colors.textOnDarkMuted} align="center">
          {t('myBoards.cropHint')}
        </AppText>
        <View style={styles.tools}>
          <View style={styles.tool}>
            <IconButton
              icon="refresh"
              accessibilityLabel={t('myBoards.rotate')}
              onPress={() => cropper.current?.rotate()}
            />
            <AppText variant="caption" color={colors.textOnDark}>
              {t('myBoards.rotate')}
            </AppText>
          </View>
          <View style={styles.tool}>
            <IconButton
              icon="scan"
              accessibilityLabel={t('myBoards.reset')}
              onPress={() => cropper.current?.reset()}
            />
            <AppText variant="caption" color={colors.textOnDark}>
              {t('myBoards.reset')}
            </AppText>
          </View>
        </View>
        <View style={styles.buttons}>
          {!isLast ? (
            <GameButton
              label={t('myBoards.doneAll')}
              variant="secondary"
              size="md"
              disabled={busy}
              style={styles.flex}
              onPress={() => void go(true)}
            />
          ) : null}
          <GameButton
            label={busy ? t('myBoards.saving') : isLast ? t('common.done') : t('myBoards.next')}
            icon={isLast ? 'checkmark' : 'arrow-forward'}
            size="md"
            disabled={busy}
            style={styles.flex}
            onPress={() => void go(false)}
          />
        </View>
      </View>
      <Dialog
        visible={error}
        title={t('myBoards.saveFailed')}
        onRequestClose={() => setError(false)}
      >
        <GameButton label={t('common.ok')} size="md" onPress={() => setError(false)} />
      </Dialog>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, gap: spacing.md, justifyContent: 'space-between' },
  cropperBleed: { marginHorizontal: -spacing.lg },
  tools: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xxl },
  tool: { alignItems: 'center', gap: spacing.xs },
  buttons: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
});
