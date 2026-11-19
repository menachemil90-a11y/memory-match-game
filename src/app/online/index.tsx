import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { usePlayersStore } from '@/features/players/playersStore';
import { OnlineProfileCard } from '@/features/online/components/OnlineProfileCard';
import { isOnlineConfigured } from '@/features/online/config';
import { checkNickname } from '@/features/online/nickname';
import {
  codeFromText,
  isValidRoomCode,
  normalizeRoomCode,
  ROOM_CODE_LENGTH,
} from '@/features/online/roomCode';
import { AppText, GameButton, Screen } from '@/ui/components';
import { colors, fonts, palette, radii, shadows, spacing } from '@/ui/theme';

export default function OnlineLobbyScreen() {
  const { t } = useTranslation();
  const name = usePlayersStore((s) => s.online.name);
  const [code, setCode] = useState('');
  const [showErrors, setShowErrors] = useState(false);

  if (!isOnlineConfigured) {
    return (
      <Screen title={t('online.title')}>
        <View style={styles.card}>
          <AppText variant="heading" align="center">
            {t('online.notConfiguredTitle')}
          </AppText>
          <AppText variant="body" color={colors.textMuted} align="center">
            {t('online.notConfiguredMessage')}
          </AppText>
        </View>
      </Screen>
    );
  }

  const nameOk = () => {
    const ok = checkNickname(name).ok;
    setShowErrors(!ok);
    return ok;
  };

  return (
    <Screen title={t('online.title')} scroll>
      <View style={styles.list}>
        <OnlineProfileCard showErrors={showErrors} />

        <View style={styles.card}>
          <AppText variant="heading">{t('online.create')}</AppText>
          <AppText variant="body" color={colors.textMuted}>
            {t('online.createHint')}
          </AppText>
          <GameButton
            label={t('online.create')}
            icon="add-circle"
            onPress={() =>
              nameOk() && router.push({ pathname: '/boards', params: { mode: 'online' } })
            }
          />
        </View>

        <View style={styles.card}>
          <AppText variant="heading">{t('online.join')}</AppText>
          <AppText variant="body" color={colors.textMuted}>
            {t('online.joinHint')}
          </AppText>
          <TextInput
            value={code}
            onChangeText={(v) => setCode(normalizeRoomCode(v))}
            placeholder="ABC234"
            placeholderTextColor={palette.mist}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={ROOM_CODE_LENGTH}
            accessibilityLabel={t('online.codeLabel')}
            style={styles.code}
          />
          <View style={styles.row}>
            <GameButton
              label={t('online.pasteInvite')}
              icon="clipboard"
              variant="secondary"
              size="md"
              style={styles.flex}
              onPress={() =>
                void Clipboard.getStringAsync().then((text) => {
                  const found = codeFromText(text);
                  if (found) setCode(found);
                })
              }
            />
            <GameButton
              label={t('online.joinButton')}
              icon="enter"
              variant="info"
              size="md"
              style={styles.flex}
              disabled={!isValidRoomCode(code)}
              onPress={() =>
                nameOk() && router.push({ pathname: '/online/[code]', params: { code, join: '1' } })
              }
            />
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.lg, paddingBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
    boxShadow: shadows.md,
  },
  code: {
    fontFamily: fonts.bold,
    fontSize: 40,
    letterSpacing: 10,
    textAlign: 'center',
    color: colors.text,
    borderWidth: 3,
    borderColor: palette.mist,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
});
