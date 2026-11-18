import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { AVATAR_SOURCES } from '@/features/boards/builtin';
import type { BoardImage } from '@/features/boards/types';
import { bestScoresRepo } from '@/features/game/bestScoresRepo';
import { formatDuration } from '@/features/game/format';
import { sessionElapsed, useGameSession, type GameSession } from '@/features/game/gameSessionStore';
import { playAgain } from '@/features/game/startGame';
import { playerColor } from '@/features/players/playersStore';
import { getOutcome, starRating, type SoloScore } from '@/game';
import { getDb } from '@/lib/db';
import { feedback } from '@/lib/feedback';
import { heroEntering, newBestEntering } from '@/ui/animation/motion';
import { AppText, Confetti, GameButton, Screen, StarRow } from '@/ui/components';
import { colors, radii, shadows, spacing } from '@/ui/theme';

/** Results are computed once per game, even if the screen re-mounts. */
const savedResults = new Map<number, { isNewBest: boolean; best: SoloScore | null }>();

function MiniPile({ images }: { images: BoardImage[] }) {
  return (
    <View style={styles.miniPile}>
      {images.map((img, i) => (
        <View
          key={`${img.id}-${i}`}
          style={[
            styles.miniCard,
            { backgroundColor: img.kind === 'art' ? img.background : colors.surface },
          ]}
          accessible
          accessibilityLabel={img.label}
        >
          <Image
            source={img.source}
            style={img.kind === 'art' ? styles.miniArt : StyleSheet.absoluteFill}
            contentFit={img.kind === 'art' ? 'contain' : 'cover'}
          />
        </View>
      ))}
    </View>
  );
}

function SoloResults({ session }: { session: GameSession }) {
  const { t } = useTranslation();
  const { state, config } = session;
  const timeMs = sessionElapsed(session);
  const stars = starRating(state.moves, state.pairsTotal);
  const [result, setResult] = useState(savedResults.get(session.id) ?? null);

  useEffect(() => {
    if (savedResults.has(session.id)) return;
    const score: SoloScore = { moves: state.moves, timeMs, stars };
    void getDb()
      .then(async (db) => {
        const previous = await bestScoresRepo.get(db, config.board.id, config.levelId);
        const isNewBest = await bestScoresRepo.saveIfBetter(
          db,
          config.board.id,
          config.levelId,
          score,
        );
        const r = { isNewBest, best: isNewBest ? score : previous };
        savedResults.set(session.id, r);
        setResult(r);
      })
      .catch(() => undefined);
    // Once per game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  return (
    <>
      <Animated.View entering={heroEntering} style={styles.hero}>
        <AppText
          variant="display"
          color={colors.textOnDark}
          align="center"
          accessibilityRole="header"
        >
          {t('results.soloTitle')}
        </AppText>
        <StarRow
          stars={stars}
          size={56}
          delay={350}
          accessibilityLabel={t('results.stars', { count: stars })}
        />
        {result?.isNewBest ? (
          <Animated.View entering={newBestEntering} style={styles.newBest}>
            <AppText variant="bodyStrong" color={colors.button.primary.text}>
              {t('results.newBest')}
            </AppText>
          </Animated.View>
        ) : null}
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(500)} style={styles.statsCard}>
        <View style={styles.stat}>
          <AppText variant="caption" color={colors.textMuted} align="center">
            {t('results.moves')}
          </AppText>
          <AppText variant="title" align="center">
            {state.moves}
          </AppText>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <AppText variant="caption" color={colors.textMuted} align="center">
            {t('results.time')}
          </AppText>
          <AppText variant="title" align="center">
            {formatDuration(timeMs)}
          </AppText>
        </View>
      </Animated.View>
      {result && !result.isNewBest && result.best ? (
        <AppText variant="bodyStrong" color={colors.textOnDarkMuted} align="center">
          {t('results.best', { moves: result.best.moves })}
        </AppText>
      ) : null}
    </>
  );
}

function VersusResults({ session }: { session: GameSession }) {
  const { t } = useTranslation();
  const { state, config } = session;
  const outcome = getOutcome(state);
  const name = (i: number) => config.players[i]?.name.trim() || t('common.playerN', { n: i + 1 });
  const imagesById = new Map(config.board.images.map((img) => [img.id, img]));
  const winner = outcome.isTie ? null : outcome.winners[0]!;

  return (
    <>
      <Animated.View entering={heroEntering} style={styles.hero}>
        {winner !== null ? (
          <View
            style={[
              styles.winnerAvatar,
              { backgroundColor: playerColor(config.players[winner]!.color).main },
            ]}
          >
            <Image
              source={AVATAR_SOURCES[config.players[winner]!.avatar]}
              style={styles.winnerImage}
            />
          </View>
        ) : (
          <View style={styles.tieRow}>
            {config.players.map((p, i) => (
              <View
                key={i}
                style={[styles.tieAvatar, { backgroundColor: playerColor(p.color).main }]}
              >
                <Image source={AVATAR_SOURCES[p.avatar]} style={styles.tieImage} />
              </View>
            ))}
          </View>
        )}
        <AppText
          variant="display"
          color={colors.textOnDark}
          align="center"
          accessibilityRole="header"
        >
          {winner !== null ? t('results.winner', { name: name(winner) }) : t('results.tie')}
        </AppText>
        {winner === null ? (
          <AppText variant="heading" color={colors.textOnDarkMuted} align="center">
            {t('results.tieSubtitle')}
          </AppText>
        ) : null}
      </Animated.View>
      {state.players.map((p, i) => {
        const color = playerColor(config.players[i]!.color);
        return (
          <Animated.View
            key={p.id}
            entering={FadeInDown.delay(400 + i * 150)}
            style={[styles.playerCard, { borderColor: color.main }]}
          >
            <View style={styles.playerHeader}>
              <View style={[styles.smallAvatar, { backgroundColor: color.main }]}>
                <Image
                  source={AVATAR_SOURCES[config.players[i]!.avatar]}
                  style={styles.smallImage}
                />
              </View>
              <AppText variant="heading" style={styles.flex} numberOfLines={1}>
                {name(i)}
              </AppText>
              <View style={[styles.scoreBadge, { backgroundColor: color.main }]}>
                <AppText variant="heading" color={colors.textOnDark}>
                  {p.collected.length}
                </AppText>
              </View>
            </View>
            <MiniPile
              images={p.collected
                .map((id) => imagesById.get(id))
                .filter((img): img is BoardImage => img !== undefined)}
            />
          </Animated.View>
        );
      })}
    </>
  );
}

export default function ResultsScreen() {
  const { t } = useTranslation();
  // Snapshot: "Play again" replaces the store's session before this screen unmounts.
  const [session] = useState(() => useGameSession.getState().session);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session?.state.phase === 'finished') feedback.win();
  }, [session?.id, session?.state.phase]);

  if (!session || session.state.phase !== 'finished') return <Redirect href="/" />;
  const { config } = session;
  const isSolo = config.mode === 'solo';

  return (
    <View style={styles.root}>
      <Screen showBack={false} scroll>
        <View style={styles.content}>
          {isSolo ? <SoloResults session={session} /> : <VersusResults session={session} />}
          <Animated.View entering={FadeInDown.delay(700)} style={styles.actions}>
            <GameButton
              label={t('results.playAgain')}
              icon="refresh"
              disabled={busy}
              onPress={() => {
                setBusy(true);
                void playAgain().finally(() => setBusy(false));
              }}
            />
            {isSolo ? (
              <GameButton
                label={t('results.changeLevel')}
                icon="grid"
                variant="info"
                size="md"
                onPress={() =>
                  router.dismissTo({
                    pathname: '/levels',
                    params: { mode: config.mode, boardId: config.board.id },
                  })
                }
              />
            ) : null}
            <GameButton
              label={t('results.changeBoard')}
              icon="albums"
              variant="success"
              size="md"
              onPress={() =>
                router.dismissTo({ pathname: '/boards', params: { mode: config.mode } })
              }
            />
            <GameButton
              label={t('results.home')}
              icon="home"
              variant="secondary"
              size="md"
              onPress={() => router.dismissTo('/')}
            />
          </Animated.View>
        </View>
      </Screen>
      <Confetti key={session.id} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { gap: spacing.lg, paddingTop: spacing.lg },
  hero: { alignItems: 'center', gap: spacing.md },
  newBest: {
    backgroundColor: colors.button.primary.face,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    transform: [{ rotate: '-4deg' }],
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    boxShadow: shadows.md,
  },
  stat: { flex: 1 },
  divider: { width: 2, backgroundColor: colors.border, marginVertical: spacing.xs },
  winnerAvatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 5,
    borderColor: colors.card.border,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: shadows.lg,
  },
  winnerImage: { width: 72, height: 72 },
  tieRow: { flexDirection: 'row', gap: spacing.md },
  tieAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 4,
    borderColor: colors.card.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tieImage: { width: 54, height: 54 },
  playerCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 3,
    boxShadow: shadows.md,
  },
  playerHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  smallAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallImage: { width: 30, height: 30 },
  scoreBadge: {
    minWidth: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  miniPile: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  miniCard: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.card.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: shadows.sm,
  },
  miniArt: { width: 28, height: 28 },
  actions: { gap: spacing.md, marginTop: spacing.sm },
});
