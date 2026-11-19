import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { AVATAR_SOURCES } from '@/features/boards/builtin';
import { OnlineRoomGame } from '@/features/online/OnlineRoomGame';
import { OnlineProfileCard } from '@/features/online/components/OnlineProfileCard';
import { APP_SCHEME, isOnlineConfigured } from '@/features/online/config';
import { checkNickname } from '@/features/online/nickname';
import { useOnline } from '@/features/online/onlineStore';
import {
  androidOpenInAppLink,
  inviteLink,
  isValidRoomCode,
  normalizeRoomCode,
} from '@/features/online/roomCode';
import { isPhotoRoom } from '@/features/online/roomPhotos';
import { shareInvite } from '@/features/online/shareInvite';
import { useOnlineError } from '@/features/online/useOnlineError';
import { usePlayersStore } from '@/features/players/playersStore';
import { deviceKind } from '@/features/web/device';
import { ANDROID_PACKAGE } from '@/lib/links';
import { capabilities } from '@/lib/platform/capabilities';
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
  const joining = useOnline((s) => s.joining);
  const inThisRoom = room?.code === code && seat !== null;
  const canJoin = isOnlineConfigured && isValidRoomCode(code);
  // Opened from a link without a nickname yet: ask for one right away.
  const [needsName, setNeedsName] = useState(
    () => !inThisRoom && canJoin && !checkNickname(profile.name).ok,
  );
  const [copied, setCopied] = useState<'code' | 'invite' | null>(null);
  /** The room code this screen already decided about joining (see below). */
  const tried = useRef<string | null>(null);
  const flashCopied = (what: 'code' | 'invite') => {
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
  };
  // On a fresh invite link there is no screen to go back to: go home instead.
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  /** The Join button. */
  const join = () => {
    if (!checkNickname(profile.name).ok) {
      setNeedsName(true);
      return;
    }
    setNeedsName(false);
    joinRoom(code, profile.name, profile.avatar).catch(error.show);
  };

  // Opened from an invite link (or the lobby's Join): join right away when the
  // nickname is already known — decided once per code, when the screen opens.
  // Leaving the room later (Back to menu) must not join it again.
  useEffect(() => {
    if (tried.current === code) return;
    tried.current = code;
    if (inThisRoom || !canJoin || !checkNickname(profile.name).ok) return;
    joinRoom(code, profile.name, profile.avatar).catch(error.show);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // The game and its results. A room the opponent closed after the game (they
  // went back to the menu) keeps showing this player's results.
  const gamePlayed =
    room?.status === 'playing' ||
    room?.status === 'finished' ||
    (room?.status === 'closed' && room.winner !== null);
  if (inThisRoom && gamePlayed) {
    return <OnlineRoomGame room={room} seat={seat} />;
  }

  if (inThisRoom && room.status === 'waiting') {
    const message = t('online.inviteMessage', { code: room.code, link: inviteLink(room.code) });
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
            {isPhotoRoom(room) ? (
              <AppText variant="caption" color={colors.textMuted} align="center">
                {t('online.photoRoomNote')}
              </AppText>
            ) : null}
          </View>
          <GameButton
            label={copied === 'invite' ? t('online.copied') : t('online.invite')}
            icon="share-social"
            testID="invite"
            onPress={() =>
              void shareInvite(message)
                .then((outcome) => outcome === 'copied' && flashCopied('invite'))
                .catch((e: unknown) => console.warn('Could not share the invite', e))
            }
          />
          <GameButton
            label={copied === 'code' ? t('online.copied') : t('online.copyCode')}
            icon="copy"
            variant="info"
            size="md"
            onPress={() => void Clipboard.setStringAsync(room.code).then(() => flashCopied('code'))}
          />
          <GameButton
            label={t('online.cancel')}
            variant="secondary"
            size="md"
            onPress={() => {
              void leave();
              goBack();
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
        ) : room?.code === code && room.status === 'preparing' ? (
          <AppText variant="heading" color={colors.textOnDark} align="center">
            {t('online.roomPreparing')}
          </AppText>
        ) : (
          <>
            <OnlineProfileCard showErrors={needsName} />
            <GameButton
              label={t('online.joinButton')}
              icon="enter"
              disabled={joining}
              onPress={join}
            />
            {/* Web game on Android: the main path is playing right here; this is for
                friends who already have the app. */}
            {capabilities.webShell && deviceKind() === 'android' && isValidRoomCode(code) ? (
              <GameButton
                label={t('web.openInApp')}
                icon="open-outline"
                variant="secondary"
                size="md"
                href={androidOpenInAppLink(APP_SCHEME, ANDROID_PACKAGE, code, inviteLink(code))}
              />
            ) : null}
          </>
        )}
      </View>
      <ProgressOverlay visible={joining} label={t('online.connecting')} progress={null} />
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
            goBack();
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
