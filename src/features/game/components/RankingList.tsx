import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { AVATAR_SOURCES } from '@/features/boards/builtin';
import type { BoardImage } from '@/features/boards/types';
import { playerColor, type PlayerProfile } from '@/features/players/playersStore';
import { MAX_PLAYERS } from '@/game';
import { AppText } from '@/ui/components';
import { colors, fonts, palette, radii, shadows, spacing } from '@/ui/theme';

export interface RankingRow {
  /** Seat (stable key). */
  index: number;
  /** 1 = first; equal scores share a place. */
  rank: number;
  profile: PlayerProfile;
  name: string;
  collected: readonly BoardImage[];
  /** Left before the end (online). */
  left?: boolean;
}

/** Place badge colors: gold, silver, bronze, then plain. */
const PLACE_COLORS: Record<number, { face: string; ink: string }> = {
  1: { face: palette.sun, ink: palette.sunInk },
  2: { face: palette.mist, ink: palette.ink },
  3: { face: palette.tangerine, ink: palette.white },
};

type Place = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Places 1…MAX_PLAYERS have a label each ("1st" … "8th"). */
function place(rank: number): Place {
  return Math.min(Math.max(Math.round(rank), 1), MAX_PLAYERS) as Place;
}

/** Final ranking (1st, 2nd, 3rd… with shared places), each with their pile. */
export function RankingList({ rows }: { rows: readonly RankingRow[] }) {
  const { t } = useTranslation();
  return (
    <View style={styles.list}>
      {rows.map((row, i) => {
        const color = playerColor(row.profile.color);
        const badge = PLACE_COLORS[row.rank] ?? { face: palette.cloud, ink: palette.ink };
        const label = t(`results.place.p${place(row.rank)}`);
        return (
          <Animated.View
            key={row.index}
            entering={FadeInDown.delay(400 + i * 120)}
            style={[styles.row, { borderColor: color.main }, row.rank === 1 && styles.first]}
            accessible
            accessibilityLabel={[
              t('results.a11yPlace', { place: label, name: row.name, count: row.collected.length }),
              row.left ? t('online.leftTag') : null,
            ]
              .filter(Boolean)
              .join(', ')}
          >
            <View style={styles.header}>
              <View style={[styles.place, { backgroundColor: badge.face }]}>
                <AppText variant="bodyStrong" color={badge.ink} style={styles.bold}>
                  {label}
                </AppText>
              </View>
              <View style={[styles.avatar, { backgroundColor: color.main }]}>
                <Image source={AVATAR_SOURCES[row.profile.avatar]} style={styles.avatarImage} />
              </View>
              <View style={styles.flex}>
                <AppText variant="heading" numberOfLines={1}>
                  {row.name}
                </AppText>
                {row.left ? (
                  <AppText variant="caption" color={colors.textMuted}>
                    {t('online.leftTag')}
                  </AppText>
                ) : null}
              </View>
              <View style={[styles.score, { backgroundColor: color.main }]}>
                <AppText variant="heading" color={colors.textOnDark}>
                  {row.collected.length}
                </AppText>
              </View>
            </View>
            {row.collected.length > 0 ? (
              <View style={styles.pile}>
                {row.collected.map((img, k) => (
                  <View
                    key={`${img.id}-${k}`}
                    style={[
                      styles.mini,
                      { backgroundColor: img.kind === 'art' ? img.background : colors.surface },
                    ]}
                  >
                    <Image
                      source={img.source}
                      style={img.kind === 'art' ? styles.miniArt : StyleSheet.absoluteFill}
                      contentFit={img.kind === 'art' ? 'contain' : 'cover'}
                      cachePolicy={img.ephemeral ? 'memory' : undefined}
                    />
                  </View>
                ))}
              </View>
            ) : null}
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  flex: { flex: 1 },
  bold: { fontFamily: fonts.bold },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 3,
    boxShadow: shadows.md,
  },
  first: { borderWidth: 4, borderColor: palette.sun },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  place: {
    minWidth: 48,
    height: 32,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: 30, height: 30 },
  score: {
    minWidth: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  pile: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  mini: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.card.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  miniArt: { width: 26, height: 26 },
});
