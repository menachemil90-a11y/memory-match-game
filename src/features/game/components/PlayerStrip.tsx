import { Image } from 'expo-image';
import type { ComponentRef, ReactNode, RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { AVATAR_SOURCES } from '@/features/boards/builtin';
import type { BoardImage } from '@/features/boards/types';
import { playerColor, type PlayerProfile } from '@/features/players/playersStore';
import { stripEntering, stripTransition } from '@/ui/animation/motion';
import { AppText } from '@/ui/components';
import { colors, fonts, palette, radii, spacing } from '@/ui/theme';

import { PlayerPanel } from './PlayerPanel';

export interface StripPlayer {
  /** Seat (index in the game's player list). */
  index: number;
  profile: PlayerProfile;
  displayName: string;
  collected: readonly BoardImage[];
  /** Left the game (online): shown faded at the end, never "next". */
  left?: boolean;
  /** Online: connection indicator. */
  presence?: { online: boolean; label: string } | null;
}

export interface PlayerStripProps {
  players: readonly StripPlayer[];
  /** Whose turn it is (null when nobody's: before the deal, after the game). */
  current: number | null;
  /** Who plays after a miss (gets the "Next" tag). */
  next: number | null;
  reduceMotion: boolean;
  /** The current player's pile, measured so matched cards fly into it. */
  pileRef?: RefObject<ComponentRef<typeof View> | null>;
  /** Online: the current player's turn clock. */
  timer?: { deadline: number; totalMs: number } | null;
  /** Shown as the last item (e.g. the pause button). */
  trailing?: ReactNode;
}

const CHIP_AVATAR = 40;

/** Seating order starting with the current player; players who left go last. */
export function stripOrder(players: readonly StripPlayer[], current: number | null): StripPlayer[] {
  const start = current === null ? 0 : players.findIndex((p) => p.index === current);
  const rotated = [...players.slice(Math.max(0, start)), ...players.slice(0, Math.max(0, start))];
  return [...rotated.filter((p) => !p.left), ...rotated.filter((p) => p.left)];
}

function Avatar({ player, size }: { player: StripPlayer; size: number }) {
  const color = playerColor(player.profile.color);
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color.main },
      ]}
    >
      <Image
        source={AVATAR_SOURCES[player.profile.avatar]}
        style={{ width: size * 0.66, height: size * 0.66 }}
      />
      {player.presence ? (
        <View
          style={[
            styles.presence,
            { backgroundColor: player.presence.online ? palette.mint : palette.slate },
          ]}
        />
      ) : null}
    </View>
  );
}

function ScoreBadge({ player }: { player: StripPlayer }) {
  return (
    <View style={[styles.badge, { backgroundColor: playerColor(player.profile.color).dark }]}>
      <AppText variant="caption" color={colors.textOnDark} style={styles.bold}>
        {player.collected.length}
      </AppText>
    </View>
  );
}

/**
 * The players of a 3–8 player game, at the top of the board: the current player
 * large and highlighted, the next one beside it with a "Next" tag, everyone else
 * compact with their score. When the turn passes, everyone slides to their new
 * place. (Two-player games keep their classic panels.)
 */
export function PlayerStrip({
  players,
  current,
  next,
  reduceMotion,
  pileRef,
  timer = null,
  trailing,
}: PlayerStripProps) {
  const { t } = useTranslation();
  const ordered = stripOrder(players, current);
  const layout = reduceMotion ? undefined : stripTransition;

  return (
    <View style={styles.strip}>
      {ordered.map((player) => {
        const label = [
          t('game.a11yStrip', { name: player.displayName, count: player.collected.length }),
          player.index === next ? t('game.a11yNext') : null,
          player.left ? t('online.leftTag') : null,
          player.presence && !player.left ? player.presence.label : null,
        ]
          .filter(Boolean)
          .join(', ');

        if (player.index === current && !player.left) {
          return (
            <Animated.View
              key={player.index}
              layout={layout}
              entering={reduceMotion ? undefined : stripEntering}
              style={styles.current}
            >
              <PlayerPanel
                profile={player.profile}
                displayName={player.displayName}
                collected={player.collected}
                active
                reduceMotion={reduceMotion}
                pileRef={pileRef}
                timer={timer}
                presence={player.presence ?? null}
              />
            </Animated.View>
          );
        }

        if (player.index === next) {
          return (
            <Animated.View
              key={player.index}
              layout={layout}
              style={styles.next}
              accessible
              accessibilityLabel={label}
            >
              <View style={styles.nextTag}>
                <AppText variant="caption" color={colors.button.primary.text} style={styles.bold}>
                  {t('game.next')}
                </AppText>
              </View>
              <Avatar player={player} size={CHIP_AVATAR} />
              <AppText
                variant="caption"
                color={colors.textOnDark}
                numberOfLines={1}
                style={styles.nextName}
              >
                {player.displayName}
              </AppText>
              <ScoreBadge player={player} />
            </Animated.View>
          );
        }

        return (
          <Animated.View
            key={player.index}
            layout={layout}
            style={[styles.compact, player.left && styles.leftPlayer]}
            accessible
            accessibilityLabel={label}
          >
            <Avatar player={player} size={CHIP_AVATAR - 6} />
            <ScoreBadge player={player} />
          </Animated.View>
        );
      })}
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // Wide enough that the next player shares its row and the others wrap below
  // on phones; on tablets more players fit beside it.
  current: { flexGrow: 1, flexBasis: '66%' },
  next: {
    width: 76,
    alignItems: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.xs,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(30,18,80,0.28)',
    borderWidth: 2,
    borderColor: palette.sun,
  },
  nextTag: {
    backgroundColor: palette.sun,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
  },
  nextName: { maxWidth: 68, fontFamily: fonts.semibold },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.xs,
    paddingRight: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(30,18,80,0.28)',
  },
  leftPlayer: { opacity: 0.45 },
  avatar: {
    borderWidth: 2,
    borderColor: colors.card.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presence: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.card.border,
  },
  badge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card.border,
  },
  bold: { fontFamily: fonts.bold },
  trailing: { marginLeft: 'auto' },
});
