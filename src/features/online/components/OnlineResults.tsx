import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AVATAR_SOURCES, getBuiltinBoard } from '@/features/boards/builtin';
import { feedback } from '@/lib/feedback';
import { heroEntering } from '@/ui/animation/motion';
import { AppText, Confetti, GameButton } from '@/ui/components';
import { colors, palette, radii, shadows, spacing } from '@/ui/theme';

import { onlineApi } from '../api';
import { useOnline } from '../onlineStore';
import type { RoomRow, Seat } from '../room';

/** End-of-game panel for online play: result, both piles, rematch. */
export function OnlineResults({ room, seat }: { room: RoomRow; seat: Seat }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const act = useOnline((s) => s.act);
  const leave = useOnline((s) => s.leave);
  const [busy, setBusy] = useState(false);
  const other = (1 - seat) as Seat;
  const otherName = room.players[other]?.name ?? '';
  const board = getBuiltinBoard(room.board_id);
  const images = new Map((board?.images ?? []).map((i) => [i.id, i]));
  const won = room.winner === seat;
  const tie = room.winner === -1;

  useEffect(() => {
    if (won || tie) feedback.win();
    else feedback.turn();
  }, [won, tie]);

  const title = tie
    ? t('online.tie')
    : won
      ? t('online.youWin')
      : t('online.youLose', { name: otherName });
  const subtitle =
    room.end_reason === 'forfeit' && won
      ? t('online.wonByForfeit', { name: otherName })
      : room.end_reason === 'disconnect' && won
        ? t('online.wonByDisconnect', { name: otherName })
        : null;
  const iAsked = room.rematch.includes(seat);
  const theyAsked = room.rematch.includes(other);
  const canRematch = room.end_reason === 'complete';

  return (
    <Animated.View entering={FadeIn} style={styles.backdrop}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <Animated.View entering={heroEntering} style={styles.hero}>
          <AppText
            variant="display"
            color={colors.textOnDark}
            align="center"
            accessibilityRole="header"
          >
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="heading" color={colors.textOnDarkMuted} align="center">
              {subtitle}
            </AppText>
          ) : null}
        </Animated.View>

        {([seat, other] as Seat[]).map((s) => (
          <View key={s} style={[styles.card, room.winner === s && styles.winnerCard]}>
            <View style={styles.cardHeader}>
              <View
                style={[styles.avatar, { backgroundColor: s === 0 ? palette.coral : palette.sky }]}
              >
                <Image source={AVATAR_SOURCES[room.players[s]!.avatar]} style={styles.avatarImg} />
              </View>
              <AppText variant="heading" style={styles.flex} numberOfLines={1}>
                {s === seat ? t('online.you') : otherName}
              </AppText>
              <AppText variant="title">{room.collected[s]?.length ?? 0}</AppText>
            </View>
            <View style={styles.pile}>
              {(room.collected[s] ?? []).map((id) => {
                const img = images.get(id);
                if (!img) return null;
                return (
                  <View key={id} style={[styles.mini, { backgroundColor: img.background }]}>
                    <Image source={img.source} style={styles.miniImg} />
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        {canRematch && theyAsked && !iAsked ? (
          <AppText variant="heading" color={palette.sun} align="center">
            {t('online.rematchAsked', { name: otherName })}
          </AppText>
        ) : null}
        <View style={styles.actions}>
          {canRematch ? (
            <GameButton
              label={iAsked ? t('online.rematchWaiting', { name: otherName }) : t('online.rematch')}
              icon="refresh"
              disabled={iAsked || busy}
              onPress={() => {
                setBusy(true);
                void act((id) => onlineApi.requestRematch(id))
                  .catch(() => undefined)
                  .finally(() => setBusy(false));
              }}
            />
          ) : null}
          <GameButton
            label={t('online.backToMenu')}
            icon="home"
            variant="secondary"
            size="md"
            onPress={() => {
              void leave();
              router.dismissTo('/');
            }}
          />
        </View>
      </ScrollView>
      {won || tie ? <Confetti key={room.game_number} /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(30, 18, 80, 0.9)',
    zIndex: 90,
    elevation: 90,
  },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  hero: { gap: spacing.sm, marginBottom: spacing.sm },
  flex: { flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.sm,
    boxShadow: shadows.md,
  },
  winnerCard: { borderWidth: 4, borderColor: palette.sun },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: 32, height: 32 },
  pile: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  mini: {
    width: 38,
    height: 38,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.card.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniImg: { width: 26, height: 26 },
  actions: { gap: spacing.md },
});
