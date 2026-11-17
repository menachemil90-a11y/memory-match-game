import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AVATAR_IDS, AVATAR_SOURCES } from '@/features/boards/builtin';
import { usePlayersStore } from '@/features/players/playersStore';
import { feedback } from '@/lib/feedback';
import { AppText } from '@/ui/components';
import {
  colors,
  fonts,
  minTouchTarget,
  palette,
  radii,
  shadows,
  spacing,
  typography,
} from '@/ui/theme';

import { MAX_NICKNAME_LENGTH, checkNickname } from '../nickname';

/** Nickname + preset avatar for online play (remembered on the device). */
export function OnlineProfileCard({ showErrors }: { showErrors: boolean }) {
  const { t } = useTranslation();
  const online = usePlayersStore((s) => s.online);
  const setOnline = usePlayersStore((s) => s.setOnline);
  const check = checkNickname(online.name);

  return (
    <View style={styles.card}>
      <AppText variant="bodyStrong">{t('online.youAre')}</AppText>
      <View style={styles.nameRow}>
        <View style={styles.avatar}>
          <Image source={AVATAR_SOURCES[online.avatar]} style={styles.avatarImg} />
        </View>
        <TextInput
          value={online.name}
          onChangeText={(name) =>
            setOnline({ ...online, name: name.slice(0, MAX_NICKNAME_LENGTH) })
          }
          placeholder={t('online.nicknamePlaceholder')}
          placeholderTextColor={colors.textMuted}
          maxLength={MAX_NICKNAME_LENGTH}
          autoCorrect={false}
          accessibilityLabel={t('online.youAre')}
          style={[styles.input, showErrors && !check.ok && styles.inputError]}
        />
      </View>
      <AppText
        variant="caption"
        color={showErrors && !check.ok ? palette.coralDark : colors.textMuted}
      >
        {showErrors && !check.ok ? t(`online.nickname.${check.reason}`) : t('online.nicknameHint')}
      </AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.avatars}
      >
        {AVATAR_IDS.map((id) => (
          <Pressable
            key={id}
            onPress={() => {
              feedback.tap();
              setOnline({ ...online, avatar: id });
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: id === online.avatar }}
            accessibilityLabel={t('setup.a11yAvatar', { avatar: t(`setup.avatars.${id}`) })}
            style={[styles.choice, id === online.avatar && styles.choiceActive]}
          >
            <Image source={AVATAR_SOURCES[id]} style={styles.choiceImg} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    boxShadow: shadows.md,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.cloud,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: 38, height: 38 },
  input: {
    flex: 1,
    ...typography.heading,
    fontFamily: fonts.semibold,
    color: colors.text,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: minTouchTarget,
  },
  inputError: { borderColor: palette.coral },
  avatars: { gap: spacing.sm },
  choice: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceActive: { borderColor: palette.grape, backgroundColor: palette.cloud },
  choiceImg: { width: 34, height: 34 },
});
