import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Pressable3D } from '@/ui/components';
import { colors, radii, spacing } from '@/ui/theme';

import { boardTileContentHeight } from './BoardTile';

export interface CreateBoardTileProps {
  width: number;
  onPress: () => void;
  /** The board tiles next to it have an edit/delete bar: match their height. */
  withActions?: boolean;
}

export function CreateBoardTile({ width, onPress, withActions = false }: CreateBoardTileProps) {
  const { t } = useTranslation();
  return (
    <Pressable3D
      onPress={onPress}
      edgeColor="rgba(30,18,80,0.35)"
      radius={radii.xl}
      style={{ width }}
      faceStyle={styles.face}
      accessibilityLabel={t('boards.create')}
    >
      <View
        style={[styles.inner, { minHeight: boardTileContentHeight(width, withActions) }]}
        testID="create-board-tile"
      >
        <View style={styles.plus}>
          <Ionicons name="add" size={44} color={colors.textOnDark} />
        </View>
        <AppText variant="heading" color={colors.textOnDark} align="center">
          {t('boards.create')}
        </AppText>
      </View>
    </Pressable3D>
  );
}

const styles = StyleSheet.create({
  face: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 4,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.75)',
  },
  inner: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.md },
  plus: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.button.success.face,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.card.border,
  },
});
