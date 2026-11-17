import { Image } from 'expo-image';
import { memo, useEffect, type ComponentRef, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { AVATAR_SOURCES } from '@/features/boards/builtin';
import type { BoardImage } from '@/features/boards/types';
import { playerColor, type PlayerProfile } from '@/features/players/playersStore';
import { AppText } from '@/ui/components';
import { colors, fonts, radii, spacing } from '@/ui/theme';

export interface PlayerPanelProps {
  profile: PlayerProfile;
  displayName: string;
  collected: readonly BoardImage[];
  active: boolean;
  /** Tabletop mode: the panel faces the player across the table. */
  rotated?: boolean;
  reduceMotion: boolean;
  /** Ref to the pile view, measured so matched cards can fly into it. */
  pileRef?: RefObject<ComponentRef<typeof View> | null>;
  onPileLayout?: () => void;
}

const PILE_CARD = 38;

/** Name, avatar and the growing pile of collected pairs for one player. */
export const PlayerPanel = memo(function PlayerPanel({
  profile,
  displayName,
  collected,
  active,
  rotated = false,
  reduceMotion,
  pileRef,
  onPileLayout,
}: PlayerPanelProps) {
  const { t } = useTranslation();
  const color = playerColor(profile.color);
  const bump = useSharedValue(1);
  const activeAnim = useSharedValue(active ? 1 : 0);
  const count = collected.length;

  useEffect(() => {
    if (count > 0 && !reduceMotion) {
      bump.set(
        withSequence(
          withSpring(1.35, { damping: 6, stiffness: 320 }),
          withSpring(1, { damping: 10, stiffness: 200 }),
        ),
      );
    }
  }, [count, reduceMotion, bump]);

  useEffect(() => {
    activeAnim.set(withTiming(active ? 1 : 0, { duration: reduceMotion ? 0 : 220 }));
  }, [active, reduceMotion, activeAnim]);

  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.97 + activeAnim.value * 0.03 }, { rotate: rotated ? '180deg' : '0deg' }],
  }));

  const top = collected.slice(-3);

  return (
    <Animated.View
      style={[
        styles.panel,
        {
          backgroundColor: active ? color.main : 'rgba(255,255,255,0.16)',
          borderColor: active ? colors.card.border : 'transparent',
        },
        panelStyle,
      ]}
      accessible
      accessibilityLabel={`${displayName}, ${t('game.collected', { count })}`}
    >
      <View style={[styles.avatar, { borderColor: color.main }]}>
        <Image source={AVATAR_SOURCES[profile.avatar]} style={styles.avatarImage} />
      </View>
      <View style={styles.info}>
        <AppText variant="heading" color={colors.textOnDark} numberOfLines={1} style={styles.name}>
          {displayName}
        </AppText>
        <AppText variant="caption" color={colors.textOnDarkMuted}>
          {t('game.collected', { count })}
        </AppText>
      </View>
      <View ref={pileRef} collapsable={false} onLayout={onPileLayout} style={styles.pile}>
        {top.length === 0 ? <View style={styles.pileEmpty} /> : null}
        {top.map((img, i) => (
          <View
            key={`${img.id}-${count - top.length + i}`}
            style={[
              styles.pileCard,
              {
                backgroundColor: img.kind === 'art' ? img.background : colors.card.face,
                transform: [{ rotate: `${(i - 1) * 9}deg` }, { translateX: (i - 1) * 6 }],
              },
            ]}
          >
            <Image
              source={img.source}
              style={img.kind === 'photo' ? StyleSheet.absoluteFill : styles.pileArt}
              contentFit={img.kind === 'photo' ? 'cover' : 'contain'}
            />
          </View>
        ))}
        <Animated.View style={[styles.badge, { backgroundColor: color.dark }, badgeStyle]}>
          <AppText variant="caption" color={colors.textOnDark} style={styles.badgeText}>
            {count}
          </AppText>
        </Animated.View>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 3,
    minHeight: 72,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: 36, height: 36 },
  info: { flex: 1 },
  name: { fontFamily: fonts.bold },
  pile: {
    width: PILE_CARD + 28,
    height: PILE_CARD + 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pileEmpty: {
    width: PILE_CARD,
    height: PILE_CARD,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.6)',
  },
  pileCard: {
    position: 'absolute',
    width: PILE_CARD,
    height: PILE_CARD,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.card.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pileArt: { width: PILE_CARD * 0.7, height: PILE_CARD * 0.7 },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: -4,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card.border,
  },
  badgeText: { fontFamily: fonts.bold },
});
