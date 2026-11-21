import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  AccessibilityInfo,
  AppState,
  BackHandler,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { CARD_BACK_SOURCES } from '@/features/boards/builtin';
import type { BoardImage } from '@/features/boards/types';
import { playerColor } from '@/features/players/playersStore';
import { useSettingsStore } from '@/features/settings/settingsStore';
import { feedback } from '@/lib/feedback';
import { AppText, Dialog, GameButton, IconButton } from '@/ui/components';
import { upcomingPlayer } from '@/game';
import { colors, motion, spacing } from '@/ui/theme';

import { GameCard, type CardEffect, type DealIn, type FlyTarget } from './components/GameCard';
import { PlayerPanel } from './components/PlayerPanel';
import { PlayerStrip, type StripPlayer } from './components/PlayerStrip';
import { SoloHud } from './components/SoloHud';
import { TurnBanner } from './components/TurnBanner';
import { useGameSession, sessionElapsed, type GameSession } from './gameSessionStore';
import { cardPosition, computeGridLayout } from './gridLayout';

type ViewRef = ComponentRef<typeof View>;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Stage = 'loading' | 'dealing' | 'playing';

interface ActiveEffect {
  version: number;
  indices: readonly number[];
  kind: 'match' | 'mismatch';
  flying: boolean;
}

function measure(ref: ViewRef | null): Promise<Box | null> {
  return new Promise((resolve) => {
    if (!ref) return resolve(null);
    ref.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
}

export function GameView({ session }: { session: GameSession }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const flipBackSpeed = useSettingsStore((s) => s.flipBackSpeed);
  const dispatch = useGameSession((s) => s.dispatch);
  const resumeTimer = useGameSession((s) => s.resumeTimer);
  const pauseTimer = useGameSession((s) => s.pauseTimer);

  const { state, config } = session;
  const { board, mode } = config;
  const isSolo = mode === 'solo';
  /** 3+ players: one strip at the top instead of a panel per side. */
  const group = !isSolo && config.players.length > 2;
  const tabletop = !isSolo && !group && config.tabletop;

  const imagesById = useMemo(
    () => new Map<string, BoardImage>(board.images.map((img) => [img.id, img])),
    [board.images],
  );
  const cardBack = CARD_BACK_SOURCES[board.cardBack];

  const [stage, setStage] = useState<Stage>('loading');
  const [effect, setEffect] = useState<ActiveEffect | null>(null);
  const [gridSize, setGridSize] = useState<{ width: number; height: number } | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const skipReadyRef = useRef(false);

  const gridRef = useRef<ViewRef>(null);
  const pileRefs = [useRef<ViewRef>(null), useRef<ViewRef>(null)];
  /** 3+ players: the pile of the current player (in the strip). */
  const stripPileRef = useRef<ViewRef>(null);
  const [flyTargets, setFlyTargets] = useState<Record<number, FlyTarget> | null>(null);

  const layout = useMemo(
    () =>
      gridSize ? computeGridLayout(gridSize.width, gridSize.height, state.cols, state.rows) : null,
    [gridSize, state.cols, state.rows],
  );

  // ---- Preload every image on the board before dealing (no flicker). ----
  useEffect(() => {
    let cancelled = false;
    const sources = [
      cardBack,
      ...new Set(state.cards.map((c) => imagesById.get(c.imageId)?.source)),
    ];
    Promise.allSettled(
      sources.filter((s) => s !== undefined).map((s) => Image.loadAsync(s)),
    ).finally(() => {
      if (!cancelled) setStage('dealing');
    });
    return () => {
      cancelled = true;
    };
    // Once per game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Deal-in: staggered, with soft "deal" ticks. ----
  const dealDuration = reduceMotion ? 200 : state.cards.length * motion.dealStagger + 520;
  useEffect(() => {
    if (stage !== 'dealing' || !layout) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (!reduceMotion) {
      const ticks = Math.min(8, Math.ceil(state.cards.length / 4));
      for (let i = 0; i < ticks; i++) {
        timers.push(
          setTimeout(feedback.deal, (i * state.cards.length * motion.dealStagger) / ticks),
        );
      }
    }
    timers.push(
      setTimeout(() => {
        setStage('playing');
      }, dealDuration),
    );
    return () => timers.forEach(clearTimeout);
  }, [stage, layout, reduceMotion, dealDuration, state.cards.length]);

  // ---- Fly targets: offset from each card to the current player's pile. ----
  const computeFlyTargets = useCallback(
    async (indices: readonly number[], player: number) => {
      if (!layout) return null;
      const [grid, pile] = await Promise.all([
        measure(gridRef.current),
        measure(group ? stripPileRef.current : (pileRefs[isSolo ? 0 : player]?.current ?? null)),
      ]);
      if (!grid || !pile) return null;
      const targets: Record<number, FlyTarget> = {};
      for (const index of indices) {
        const pos = cardPosition(layout, state.cols, index);
        targets[index] = {
          dx: pile.x + pile.width / 2 - (grid.x + pos.x + layout.cardSize / 2),
          dy: pile.y + pile.height / 2 - (grid.y + pos.y + layout.cardSize / 2),
        };
      }
      return targets;
    },
    // pileRefs are stable refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layout, isSolo, group, state.cols],
  );

  const resolveNow = useCallback(() => {
    skipReadyRef.current = false;
    setEffect(null);
    setFlyTargets(null);
    dispatch({ type: 'resolve' });
  }, [dispatch]);

  // ---- Turn resolution: match → pop, glow, fly to pile; miss → shake, wait, flip back. ----
  useEffect(() => {
    if (state.phase !== 'resolving') return;
    const indices = state.flipped;
    const version = state.version;
    const player = state.currentPlayer;
    const afterFlip = reduceMotion ? 60 : motion.flip;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const label = imagesById.get(state.cards[indices[0]!]!.imageId)?.label ?? '';

    if (state.pendingResult === 'match') {
      timers.push(
        setTimeout(() => {
          setEffect({ version, indices, kind: 'match', flying: false });
          feedback.match();
          AccessibilityInfo.announceForAccessibility(t('game.a11yMatch', { label }));
        }, afterFlip),
      );
      timers.push(
        setTimeout(
          () => {
            void computeFlyTargets(indices, player).then((targets) => {
              if (!targets) {
                resolveNow();
                return;
              }
              setFlyTargets(targets);
              setEffect({ version, indices, kind: 'match', flying: true });
            });
          },
          afterFlip + (reduceMotion ? 250 : 520),
        ),
      );
      // Safety net in case an animation callback never fires.
      timers.push(setTimeout(resolveNow, afterFlip + 2600));
    } else {
      const delay = motion.mismatchDelay[flipBackSpeed];
      timers.push(
        setTimeout(() => {
          setEffect({ version, indices, kind: 'mismatch', flying: false });
          skipReadyRef.current = true;
          feedback.miss();
          AccessibilityInfo.announceForAccessibility(t('game.a11yNoMatch'));
        }, afterFlip),
      );
      timers.push(setTimeout(resolveNow, afterFlip + delay));
    }
    return () => timers.forEach(clearTimeout);
    // Re-run only when the engine enters a new resolving state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.version]);

  // ---- Turn passes (2 players): banner + chime. ----
  const prevPlayerRef = useRef(state.currentPlayer);
  useEffect(() => {
    if (prevPlayerRef.current === state.currentPlayer) return;
    prevPlayerRef.current = state.currentPlayer;
    if (!isSolo && state.phase !== 'finished') {
      feedback.turn();
      AccessibilityInfo.announceForAccessibility(
        t('game.a11yTurn', { name: displayName(state.currentPlayer) }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentPlayer]);

  // ---- Game over → results. ----
  useEffect(() => {
    if (state.phase !== 'finished') return;
    const id = setTimeout(() => router.replace('/results'), reduceMotion ? 150 : 650);
    return () => clearTimeout(id);
  }, [state.phase, reduceMotion]);

  // ---- Timer pauses in the background; Android back asks before leaving. ----
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') pauseTimer();
      else if (useGameSession.getState().session?.state.moves) resumeTimer();
    });
    return () => {
      sub.remove();
      pauseTimer();
    };
  }, [pauseTimer, resumeTimer]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        setLeaveOpen(true);
        return true;
      });
      return () => sub.remove();
    }, []),
  );

  function displayName(index: number): string {
    const name = config.players[index]?.name.trim();
    if (isSolo) return t('game.you');
    return name || t('common.playerN', { n: index + 1 });
  }

  // ---- Input ----
  const onCardPress = useCallback(
    (index: number) => {
      const current = useGameSession.getState().session?.state;
      if (stage !== 'playing' || !current) return;
      if (current.phase === 'resolving') {
        // Tapping the board skips the rest of the mismatch delay.
        if (current.pendingResult === 'mismatch' && skipReadyRef.current) resolveNow();
        return;
      }
      if (dispatch({ type: 'flip', index, player: current.currentPlayer })) {
        feedback.flip();
        resumeTimer();
      }
    },
    [stage, dispatch, resumeTimer, resolveNow],
  );

  const onBoardPress = useCallback(() => {
    const current = useGameSession.getState().session?.state;
    if (
      current?.phase === 'resolving' &&
      current.pendingResult === 'mismatch' &&
      skipReadyRef.current
    ) {
      resolveNow();
    }
  }, [resolveNow]);

  // Stable callback (cards restart their fly animation if it changes).
  const effectRef = useRef(effect);
  useEffect(() => {
    effectRef.current = effect;
  }, [effect]);
  const onFlyEnd = useCallback(
    (index: number) => {
      const current = effectRef.current;
      if (current?.flying && index === current.indices[0]) resolveNow();
    },
    [resolveNow],
  );

  const onGridLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setGridSize((prev) =>
      prev && prev.width === width && prev.height === height ? prev : { width, height },
    );
  };

  // Deck position for the deal-in: bottom center of the grid area.
  const dealIn = (index: number): DealIn | null => {
    if (stage === 'playing' || !layout || !gridSize) return null;
    const pos = cardPosition(layout, state.cols, index);
    return {
      dx: gridSize.width / 2 - layout.cardSize / 2 - pos.x,
      dy: gridSize.height - layout.cardSize * 0.6 - pos.y,
      delay: index * motion.dealStagger,
    };
  };

  const currentColor = playerColor(config.players[state.currentPlayer]?.color ?? 'coral');
  const collectedImages = (playerIndex: number) =>
    (state.players[playerIndex]?.collected ?? [])
      .map((id) => imagesById.get(id))
      .filter((img): img is BoardImage => img !== undefined);

  const stripPlayers: StripPlayer[] = config.players.map((profile, index) => ({
    index,
    profile,
    displayName: displayName(index),
    collected: collectedImages(index),
  }));

  const playerPanel = (index: number, rotated = false) => (
    <PlayerPanel
      profile={config.players[index]!}
      displayName={displayName(index)}
      collected={collectedImages(index)}
      active={!isSolo && state.currentPlayer === index && state.phase !== 'finished'}
      rotated={rotated}
      reduceMotion={reduceMotion}
      pileRef={pileRefs[index]}
    />
  );

  return (
    <LinearGradient colors={colors.backgroundGradient} style={styles.root}>
      <View
        style={[
          styles.inner,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: insets.bottom + spacing.sm,
            paddingLeft: insets.left + spacing.md,
            paddingRight: insets.right + spacing.md,
          },
        ]}
      >
        {group ? (
          <View style={styles.stripRow}>
            <PlayerStrip
              players={stripPlayers}
              current={state.phase === 'finished' ? null : state.currentPlayer}
              next={upcomingPlayer(state)}
              reduceMotion={reduceMotion}
              pileRef={stripPileRef}
              trailing={
                <IconButton
                  icon="pause"
                  accessibilityLabel={t('game.pause')}
                  onPress={() => setLeaveOpen(true)}
                  size={48}
                />
              }
            />
          </View>
        ) : (
          <View style={styles.topRow}>
            {tabletop ? null : (
              <IconButton
                icon="pause"
                accessibilityLabel={t('game.pause')}
                onPress={() => setLeaveOpen(true)}
                size={48}
              />
            )}
            {isSolo ? (
              <SoloHud
                moves={state.moves}
                pairsFound={state.pairsFound}
                pairsTotal={state.pairsTotal}
                getElapsed={() => {
                  const s = useGameSession.getState().session;
                  return s ? sessionElapsed(s) : 0;
                }}
              />
            ) : (
              <View style={styles.flex}>{playerPanel(1, tabletop)}</View>
            )}
          </View>
        )}

        <Pressable
          style={styles.gridArea}
          onPress={onBoardPress}
          accessible={false}
          importantForAccessibility="no"
        >
          <View
            ref={gridRef}
            collapsable={false}
            style={styles.grid}
            onLayout={onGridLayout}
            testID="game-grid"
          >
            {layout && stage !== 'loading'
              ? state.cards.map((card) => {
                  const pos = cardPosition(layout, state.cols, card.index);
                  const image = imagesById.get(card.imageId);
                  if (!image) return null;
                  const effectHere =
                    effect &&
                    effect.version === state.version &&
                    effect.indices.includes(card.index);
                  const cardEffect: CardEffect = effectHere ? effect.kind : 'none';
                  const slot = (
                    <View
                      key={`slot-${card.index}`}
                      style={[
                        styles.slot,
                        {
                          left: pos.x,
                          top: pos.y,
                          width: layout.cardSize,
                          height: layout.cardSize,
                          borderRadius: layout.cardSize * 0.16,
                        },
                      ]}
                    />
                  );
                  if (card.status === 'matched') return slot;
                  return [
                    slot,
                    <GameCard
                      key={card.index}
                      index={card.index}
                      x={pos.x}
                      y={pos.y}
                      size={layout.cardSize}
                      image={image}
                      cardBack={cardBack}
                      faceUp={card.status === 'up'}
                      effect={cardEffect}
                      glowColor={currentColor.main}
                      flyTo={
                        effectHere && effect.flying ? (flyTargets?.[card.index] ?? null) : null
                      }
                      dealIn={dealIn(card.index)}
                      reduceMotion={reduceMotion}
                      accessibilityLabel={
                        card.status === 'up'
                          ? t('game.a11yCardUp', { n: card.index + 1, label: image.label })
                          : t('game.a11yCardDown', { n: card.index + 1 })
                      }
                      accessibilityHint={card.status === 'down' ? t('game.a11yHint') : undefined}
                      onPress={onCardPress}
                      onFlyEnd={onFlyEnd}
                    />,
                  ];
                })
              : null}
          </View>
        </Pressable>

        {group ? null : (
          <View style={styles.bottomRow}>
            <View style={styles.flex}>{playerPanel(0)}</View>
            {tabletop ? (
              <IconButton
                icon="pause"
                accessibilityLabel={t('game.pause')}
                onPress={() => setLeaveOpen(true)}
                size={48}
              />
            ) : null}
          </View>
        )}

        {!isSolo ? (
          <TurnBanner
            playerIndex={state.currentPlayer}
            enabled={stage === 'playing' && state.phase !== 'finished'}
            profile={config.players[state.currentPlayer]!}
            text={t(group ? 'game.passPhone' : 'game.yourTurn', {
              name: displayName(state.currentPlayer),
            })}
            rotated={tabletop && state.currentPlayer === 1}
            reduceMotion={reduceMotion}
            big={group}
          />
        ) : null}
      </View>

      <Dialog
        visible={leaveOpen}
        title={t('game.leaveTitle')}
        message={t('game.leaveMessage')}
        onRequestClose={() => setLeaveOpen(false)}
      >
        <GameButton
          label={t('game.keepPlaying')}
          variant="success"
          size="md"
          onPress={() => setLeaveOpen(false)}
        />
        <GameButton
          label={t('game.leave')}
          variant="secondary"
          size="md"
          onPress={() => {
            setLeaveOpen(false);
            useGameSession.getState().pauseTimer();
            router.dismissTo('/');
          }}
        />
      </Dialog>
      {stage === 'loading' ? (
        <View style={styles.loading} pointerEvents="none">
          <AppText variant="heading" color={colors.textOnDark}>
            {t('common.loading')}
          </AppText>
        </View>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1, gap: spacing.sm },
  flex: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, zIndex: 1 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, zIndex: 1 },
  stripRow: { zIndex: 1 },
  gridArea: { flex: 1, zIndex: 10 },
  grid: { flex: 1 },
  slot: {
    position: 'absolute',
    backgroundColor: 'rgba(30, 18, 80, 0.12)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
