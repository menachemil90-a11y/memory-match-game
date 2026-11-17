import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Pressable3D } from '@/ui/components';
import { colors, radii, spacing } from '@/ui/theme';

export function CreateBoardTile({ width, onPress }: { width: number; onPress: () => void }) {
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
      <View style={[styles.inner, { minHeight: width * 0.7 + 52 }]}>
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
