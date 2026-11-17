import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  AccessibilityInfo,
  BackHandler,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { CARD_BACK_SOURCES, getBuiltinBoard } from '@/features/boards/builtin';
import type { BoardImage } from '@/features/boards/types';
import {
  GameCard,
  type CardEffect,
  type DealIn,
  type FlyTarget,
} from '@/features/game/components/GameCard';
import { PlayerPanel } from '@/features/game/components/PlayerPanel';
import { TurnBanner } from '@/features/game/components/TurnBanner';
import { cardPosition, computeGridLayout } from '@/features/game/gridLayout';
import type { PlayerProfile } from '@/features/players/playersStore';
import { getLevel } from '@/game';
import { feedback } from '@/lib/feedback';
import { AppText, Dialog, GameButton, IconButton } from '@/ui/components';
import { colors, motion, palette, radii, spacing } from '@/ui/theme';

import { onlineApi } from './api';
import { CoinFlip } from './components/CoinFlip';
import { OnlineResults } from './components/OnlineResults';
import { DISCONNECT_GRACE_SECONDS, TURN_SECONDS } from './config';
import type { OnlineError } from './errors';
import { useOnline } from './onlineStore';
import { msUntil, opponentSilenceSeconds, type RoomRow, type Seat } from './room';

type ViewRef = ComponentRef<typeof View>;
type Stage = 'coin' | 'dealing' | 'playing';

function measure(ref: ViewRef | null) {
  return new Promise<{ x: number; y: number; width: number; height: number } | null>((resolve) => {
    if (!ref) return resolve(null);
    ref.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
}

const PLAYER_COLORS = ['coral', 'sky'] as const;

/** One online game (a new instance per game number, so rematches start fresh). */
export function OnlineGameView({ room, seat }: { room: RoomRow; seat: Seat }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const act = useOnline((s) => s.act);
  const leave = useOnline((s) => s.leave);
  const clockOffset = useOnline((s) => s.clockOffsetMs);
  const connection = useOnline((s) => s.connection);
  const opponentPresent = useOnline((s) => s.opponentPresent);

  const board = getBuiltinBoard(room.board_id);
  const images = useMemo(() => new Map((board?.images ?? []).map((i) => [i.id, i])), [board]);
  const placeholder = board?.images[0];
  const other = (1 - seat) as Seat;
  const profiles: PlayerProfile[] = room.players.map((p, i) => ({
    name: p.name,
    avatar: p.avatar,
    color: PLAYER_COLORS[i] ?? 'coral',
  }));
  const nameOf = (s: Seat) => (s === seat ? t('online.you') : (room.players[s]?.name ?? ''));

  const [stage, setStage] = useState<Stage>(room.moves[0] + room.moves[1] > 0 ? 'playing' : 'coin');
  const [gridSize, setGridSize] = useState<{ width: number; height: number } | null>(null);
  const [effect, setEffect] = useState<{
    key: string;
    kind: 'match' | 'mismatch';
    flying: boolean;
  } | null>(null);
  const [flyTargets, setFlyTargets] = useState<Record<number, FlyTarget> | null>(null);
  const [busyFlip, setBusyFlip] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [awayDismissedAt, setAwayDismissedAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const gridRef = useRef<ViewRef>(null);
  const myPile = useRef<ViewRef>(null);
  const theirPile = useRef<ViewRef>(null);

  const layout = useMemo(
    () =>
      gridSize
        ? computeGridLayout(gridSize.width, gridSize.height, cardCols(room), cardRows(room))
        : null,
    [gridSize, room],
  );
  const cols = cardCols(room);
  const key = `${room.game_number}:${room.version}`;
  const isMyTurn = room.status === 'playing' && room.current_player === seat;

  // Clock tick for the "opponent away" check.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(id);
  }, []);

  // ---- Deal-in after the coin flip ----
  useEffect(() => {
    if (stage !== 'dealing' || !layout) return;
    const n = room.cards.length;
    const timers = [
      setTimeout(() => setStage('playing'), reduceMotion ? 200 : n * motion.dealStagger + 520),
    ];
    if (!reduceMotion) {
      for (let i = 0; i < Math.ceil(n / 4); i++) {
        timers.push(setTimeout(feedback.deal, i * 4 * motion.dealStagger));
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [stage, layout, reduceMotion, room.cards.length]);

  // ---- Resolve requests (both phones call; the server accepts the first) ----
  const resolve = useCallback(
    async (skip = false) => {
      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          await act((id) => onlineApi.resolveTurn(id, skip));
          return;
        } catch (e) {
          if ((e as OnlineError).code !== 'too_early') return;
          await new Promise((r) => setTimeout(r, 250));
        }
      }
    },
    [act],
  );

  // ---- Effects for a pending pair ----
  useEffect(() => {
    if (room.phase !== 'resolving' || stage !== 'playing') return;
    const [a] = room.flipped;
    const collector = room.current_player as Seat;
    const afterFlip = reduceMotion ? 60 : motion.flip;
    const label = (a !== undefined && images.get(room.cards[a]?.i ?? '')?.label) || '';
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (room.pending_result === 'match') {
      timers.push(
        setTimeout(() => {
          setEffect({ key, kind: 'match', flying: false });
          feedback.match();
          AccessibilityInfo.announceForAccessibility(t('game.a11yMatch', { label }));
        }, afterFlip),
        setTimeout(
          async () => {
            const [grid, pile] = await Promise.all([
              measure(gridRef.current),
              measure((collector === seat ? myPile : theirPile).current),
            ]);
            if (!grid || !pile || !layout) {
              void resolve();
              return;
            }
            const targets: Record<number, FlyTarget> = {};
            for (const index of room.flipped) {
              const pos = cardPosition(layout, cols, index);
              targets[index] = {
                dx: pile.x + pile.width / 2 - (grid.x + pos.x + layout.cardSize / 2),
                dy: pile.y + pile.height / 2 - (grid.y + pos.y + layout.cardSize / 2),
              };
            }
            setFlyTargets(targets);
            setEffect({ key, kind: 'match', flying: true });
          },
          afterFlip + (reduceMotion ? 250 : 520),
        ),
        setTimeout(() => void resolve(), afterFlip + 2600),
      );
    } else {
      timers.push(
        setTimeout(() => {
          setEffect({ key, kind: 'mismatch', flying: false });
          feedback.miss();
          AccessibilityInfo.announceForAccessibility(t('game.a11yNoMatch'));
        }, afterFlip),
        setTimeout(
          () => void resolve(),
          Math.max(afterFlip + 300, msUntil(room.resolve_at, clockOffset) + 50),
        ),
      );
    }
    return () => timers.forEach(clearTimeout);
    // Once per server state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, stage]);

  // ---- Turn passes: banner + chime ----
  const prevPlayer = useRef(room.current_player);
  useEffect(() => {
    if (prevPlayer.current === room.current_player) return;
    prevPlayer.current = room.current_player;
    if (room.status === 'playing') {
      feedback.turn();
      AccessibilityInfo.announceForAccessibility(
        room.current_player === seat
          ? t('online.yourTurn')
          : t('online.theirTurn', { name: room.players[other]?.name ?? '' }),
      );
    }
  }, [room.current_player, room.status, room.players, seat, other, t]);

  // ---- Turn timer: claim the timeout on the server when the clock runs out ----
  useEffect(() => {
    if (room.status !== 'playing' || !room.turn_deadline) return;
    const wait = Math.max(0, msUntil(room.turn_deadline, clockOffset)) + 400;
    const id = setTimeout(() => {
      void act((rid) => onlineApi.claimTimeout(rid)).catch(() => undefined);
    }, wait);
    return () => clearTimeout(id);
  }, [room.turn_deadline, room.status, clockOffset, act]);

  // ---- Android back = leave dialog ----
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        setLeaveOpen(true);
        return true;
      });
      return () => sub.remove();
    }, []),
  );

  const onCardPress = useCallback(
    (index: number) => {
      if (stage !== 'playing') return;
      if (room.phase === 'resolving') {
        if (
          room.pending_result === 'mismatch' &&
          room.current_player === seat &&
          effect?.kind === 'mismatch'
        ) {
          void resolve(true);
        }
        return;
      }
      if (!isMyTurn || busyFlip || room.cards[index]?.s !== 'down') return;
      feedback.flip();
      setBusyFlip(true);
      act((id) => onlineApi.flipCard(id, index))
        .catch((e: OnlineError) => {
          if (e.code === 'network') setError(t('online.errors.network'));
        })
        .finally(() => setBusyFlip(false));
    },
    [stage, room, seat, effect, isMyTurn, busyFlip, act, resolve, t],
  );

  const effectRef = useRef(effect);
  useEffect(() => {
    effectRef.current = effect;
  }, [effect]);
  const onFlyEnd = useCallback(
    (index: number) => {
      if (effectRef.current?.flying && index === room.flipped[0]) void resolve();
    },
    [resolve, room.flipped],
  );

  const onGridLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setGridSize((p) => (p && p.width === width && p.height === height ? p : { width, height }));
  };

  if (!board || !placeholder) return null;

  const timerFor = (s: Seat) =>
    room.status === 'playing' &&
    room.current_player === s &&
    room.turn_deadline &&
    stage === 'playing'
      ? { deadline: Date.parse(room.turn_deadline) - clockOffset, totalMs: TURN_SECONDS * 1000 }
      : null;
  const collected = (s: Seat) =>
    (room.collected[s] ?? []).map((id) => images.get(id)).filter((i): i is BoardImage => !!i);
  const away =
    room.status === 'playing' &&
    opponentSilenceSeconds(room, seat, clockOffset, now) > DISCONNECT_GRACE_SECONDS &&
    now - awayDismissedAt > 30_000;

  const dealIn = (index: number): DealIn | null => {
    if (stage === 'playing' || !layout || !gridSize) return null;
    const pos = cardPosition(layout, cols, index);
    return {
      dx: gridSize.width / 2 - layout.cardSize / 2 - pos.x,
      dy: gridSize.height - layout.cardSize * 0.6 - pos.y,
      delay: index * motion.dealStagger,
    };
  };

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
        <View style={styles.row}>
          <IconButton
            icon="close"
            accessibilityLabel={t('online.leave')}
            onPress={() => setLeaveOpen(true)}
            size={48}
          />
          <View style={styles.flex}>
            <PlayerPanel
              profile={profiles[other]!}
              displayName={nameOf(other)}
              collected={collected(other)}
              active={room.status === 'playing' && room.current_player === other}
              reduceMotion={reduceMotion}
              pileRef={theirPile}
              timer={timerFor(other)}
              presence={{
                online: opponentPresent,
                label: opponentPresent ? t('online.statusOnline') : t('online.statusOffline'),
              }}
            />
          </View>
        </View>

        {connection !== 'online' ? (
          <View style={styles.banner} accessibilityLiveRegion="polite">
            <AppText variant="caption" color={colors.text} align="center">
              {connection === 'connecting' ? t('online.connecting') : t('online.offline')}
            </AppText>
          </View>
        ) : null}

        <Pressable style={styles.gridArea} onPress={() => onCardPress(-1)} accessible={false}>
          <View ref={gridRef} collapsable={false} style={styles.flex} onLayout={onGridLayout}>
            {layout && stage !== 'coin'
              ? room.cards.map((card, index) => {
                  const pos = cardPosition(layout, cols, index);
                  const slot = (
                    <View
                      key={`slot-${index}`}
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
                  if (card.s === 'matched') return slot;
                  const image = (card.i ? images.get(card.i) : undefined) ?? placeholder;
                  const here = effect && effect.key === key && room.flipped.includes(index);
                  const cardEffect: CardEffect = here ? effect.kind : 'none';
                  return [
                    slot,
                    <GameCard
                      key={index}
                      index={index}
                      x={pos.x}
                      y={pos.y}
                      size={layout.cardSize}
                      image={image}
                      cardBack={CARD_BACK_SOURCES[board.cardBack]}
                      faceUp={card.s === 'up'}
                      effect={cardEffect}
                      glowColor={room.current_player === seat ? palette.coral : palette.sky}
                      flyTo={here && effect.flying ? (flyTargets?.[index] ?? null) : null}
                      dealIn={dealIn(index)}
                      reduceMotion={reduceMotion}
                      accessibilityLabel={
                        card.s === 'up'
                          ? t('game.a11yCardUp', { n: index + 1, label: image.label })
                          : t('game.a11yCardDown', { n: index + 1 })
                      }
                      onPress={onCardPress}
                      onFlyEnd={onFlyEnd}
                    />,
                  ];
                })
              : null}
          </View>
        </Pressable>

        <PlayerPanel
          profile={profiles[seat]!}
          displayName={nameOf(seat)}
          collected={collected(seat)}
          active={isMyTurn}
          reduceMotion={reduceMotion}
          pileRef={myPile}
          timer={timerFor(seat)}
        />

        {room.status === 'playing' && room.current_player !== null ? (
          <TurnBanner
            playerIndex={room.current_player}
            enabled={stage === 'playing'}
            profile={profiles[room.current_player]!}
            text={
              room.current_player === seat
                ? t('online.yourTurn')
                : t('online.theirTurn', { name: room.players[other]?.name ?? '' })
            }
            rotated={false}
            reduceMotion={reduceMotion}
          />
        ) : null}
      </View>

      {stage === 'coin' && room.starting_player !== null ? (
        <CoinFlip
          avatars={[room.players[0]!.avatar, room.players[1]!.avatar]}
          names={[nameOf(0), nameOf(1)]}
          winner={room.starting_player}
          onDone={() => setStage('dealing')}
        />
      ) : null}

      {room.status === 'finished' ? <OnlineResults room={room} seat={seat} /> : null}

      <Dialog
        visible={leaveOpen}
        title={t('online.leaveTitle')}
        message={
          room.status === 'playing'
            ? t('online.leaveMessage', { name: room.players[other]?.name ?? '' })
            : undefined
        }
        onRequestClose={() => setLeaveOpen(false)}
      >
        <GameButton
          label={t('online.stay')}
          variant="success"
          size="md"
          onPress={() => setLeaveOpen(false)}
        />
        <GameButton
          label={t('online.leave')}
          variant="secondary"
          size="md"
          onPress={() => {
            setLeaveOpen(false);
            void leave();
          }}
        />
      </Dialog>

      <Dialog
        visible={away}
        title={t('online.opponentAway', { name: room.players[other]?.name ?? '' })}
        message={t('online.opponentAwayMessage')}
        onRequestClose={() => setAwayDismissedAt(Date.now())}
      >
        <GameButton
          label={t('online.claimWin')}
          icon="trophy"
          size="md"
          onPress={() => void act((id) => onlineApi.claimDisconnectWin(id)).catch(() => undefined)}
        />
        <GameButton
          label={t('online.keepWaiting')}
          variant="secondary"
          size="md"
          onPress={() => setAwayDismissedAt(Date.now())}
        />
      </Dialog>

      <Dialog visible={error !== null} title={error ?? ''} onRequestClose={() => setError(null)}>
        <GameButton label={t('common.ok')} size="md" onPress={() => setError(null)} />
      </Dialog>
    </LinearGradient>
  );
}

function cardCols(room: RoomRow): number {
  return getLevel(room.level_id).cols;
}
function cardRows(room: RoomRow): number {
  return room.cards.length / cardCols(room);
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1, gap: spacing.sm },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, zIndex: 1 },
  gridArea: { flex: 1, zIndex: 10 },
  banner: {
    alignSelf: 'center',
    backgroundColor: palette.sun,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  slot: {
    position: 'absolute',
    backgroundColor: 'rgba(30, 18, 80, 0.12)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
  },
});
