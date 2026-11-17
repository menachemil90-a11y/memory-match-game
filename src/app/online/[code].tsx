import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { AVATAR_SOURCES } from '@/features/boards/builtin';
import { OnlineGameView } from '@/features/online/OnlineGameView';
import { OnlineProfileCard } from '@/features/online/components/OnlineProfileCard';
import { APP_SCHEME, isOnlineConfigured } from '@/features/online/config';
import { checkNickname } from '@/features/online/nickname';
import { useOnline } from '@/features/online/onlineStore';
import { inviteLink, isValidRoomCode, normalizeRoomCode } from '@/features/online/roomCode';
import { useOnlineError } from '@/features/online/useOnlineError';
import { usePlayersStore } from '@/features/players/playersStore';
import { AppText, Dialog, GameButton, ProgressOverlay, Screen } from '@/ui/components';
import { colors, fonts, palette, radii, shadows, spacing } from '@/ui/theme';

function WaitingDots() {
  const v = useSharedValue(0);
  useEffect(() => {
    v.set(
      withRepeat(
        withSequence(withTiming(1, { duration: 600 }), withTiming(0, { duration: 600 })),
        -1,
      ),
    );
  }, [v]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + v.value * 0.65,
    transform: [{ scale: 0.9 + v.value * 0.2 }],
  }));
  return (
    <Animated.View style={[styles.dots, style]}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.dot} />
      ))}
    </Animated.View>
  );
}

/** Room screen: waiting room for the host, join-by-link for friends, then the game. */
export default function OnlineRoomScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ code?: string }>();
  const code = normalizeRoomCode(params.code ?? '');
  const room = useOnline((s) => s.room);
  const seat = useOnline((s) => s.seat);
  const joinRoom = useOnline((s) => s.joinRoom);
  const leave = useOnline((s) => s.leave);
  const profile = usePlayersStore((s) => s.online);
  const error = useOnlineError();
  const [busy, setBusy] = useState(false);
  const [needsName, setNeedsName] = useState(false);
  const [copied, setCopied] = useState(false);
  const tried = useRef(false);
  const inThisRoom = room?.code === code && seat !== null;

  const join = async () => {
    if (!checkNickname(profile.name).ok) {
      setNeedsName(true);
      return;
    }
    setNeedsName(false);
    setBusy(true);
    try {
      await joinRoom(code, profile.name, profile.avatar);
    } catch (e) {
      error.show(e);
    } finally {
      setBusy(false);
    }
  };

  // Opened from an invite link (or the Join button): join automatically.
  useEffect(() => {
    if (inThisRoom || tried.current || !isOnlineConfigured || !isValidRoomCode(code)) return;
    tried.current = true;
    void join();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, inThisRoom]);

  if (inThisRoom && room.status !== 'waiting' && room.status !== 'closed') {
    return <OnlineGameView key={room.game_number} room={room} seat={seat} />;
  }

  if (inThisRoom && room.status === 'waiting') {
    const link = inviteLink(APP_SCHEME, room.code);
    return (
      <Screen title={t('online.waitingTitle')} showBack={false}>
        <View style={styles.center}>
          <View style={styles.card}>
            <View style={styles.hostAvatar}>
              <Image source={AVATAR_SOURCES[profile.avatar]} style={styles.hostImg} />
            </View>
            <AppText variant="caption" color={colors.textMuted} align="center">
              {t('online.codeLabel')}
            </AppText>
            <AppText
              variant="display"
              align="center"
              style={styles.code}
              accessibilityLabel={room.code.split('').join(' ')}
            >
              {room.code}
            </AppText>
            <WaitingDots />
            <AppText variant="body" color={colors.textMuted} align="center">
              {t('online.waitingHint')}
            </AppText>
          </View>
          <GameButton
            label={t('online.invite')}
            icon="share-social"
            onPress={() =>
              void Share.share({
                message: t('online.inviteMessage', { code: room.code, link }),
              }).catch(() => undefined)
            }
          />
          <GameButton
            label={copied ? t('online.copied') : t('online.copyCode')}
            icon="copy"
            variant="info"
            size="md"
            onPress={() =>
              void Clipboard.setStringAsync(room.code).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              })
            }
          />
          <GameButton
            label={t('online.cancel')}
            variant="secondary"
            size="md"
            onPress={() => {
              void leave();
              router.back();
            }}
          />
        </View>
      </Screen>
    );
  }

  // Not in the room yet: join (asks for a nickname first if needed).
  return (
    <Screen title={t('online.room', { code })}>
      <View style={styles.center}>
        {!isOnlineConfigured ? (
          <AppText variant="heading" color={colors.textOnDark} align="center">
            {t('online.notConfiguredMessage')}
          </AppText>
        ) : room?.code === code && room.status === 'closed' ? (
          <AppText variant="heading" color={colors.textOnDark} align="center">
            {t('online.roomClosed')}
          </AppText>
        ) : (
          <>
            <OnlineProfileCard showErrors={needsName} />
            <GameButton
              label={t('online.joinButton')}
              icon="enter"
              disabled={busy}
              onPress={() => void join()}
            />
          </>
        )}
      </View>
      <ProgressOverlay visible={busy} label={t('online.connecting')} progress={null} />
      <Dialog
        visible={error.message !== null}
        title={error.message ?? ''}
        onRequestClose={error.clear}
      >
        <GameButton
          label={t('common.ok')}
          size="md"
          onPress={() => {
            error.clear();
            router.back();
          }}
        />
      </Dialog>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', gap: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
    boxShadow: shadows.lg,
  },
  hostAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: palette.cloud,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostImg: { width: 54, height: 54 },
  code: { fontFamily: fonts.bold, letterSpacing: 8, color: palette.grape },
  dots: { flexDirection: 'row', gap: spacing.sm },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: palette.grapeLight },
});
