import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AVATAR_IDS, AVATAR_SOURCES, type AvatarId } from '@/features/boards/builtin';
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

export interface ProfileCardProps {
  /** Caption above the name ("Your online name", "Player 3"). */
  title: string;
  name: string;
  avatar: AvatarId;
  onChangeName: (name: string) => void;
  onChangeAvatar: (avatar: AvatarId) => void;
  /** Called when the name field loses focus (e.g. to tidy up spaces). */
  onEndEditing?: () => void;
  placeholder: string;
  maxLength: number;
  /** Accessible label of the name field. */
  nameLabel: string;
  /** Line under the name: a hint, or an error. */
  hint?: { text: string; error: boolean } | null;
  /** Player color: card border, avatar background and the chosen avatar's ring. */
  accent?: string;
  /** Top-right corner of the card (e.g. a remove button). */
  headerRight?: ReactNode;
  /** Extra rows at the bottom (e.g. a color picker). */
  children?: ReactNode;
}

/**
 * A player's name + preset avatar. Used for the online profile and for every
 * player of a game on one phone.
 */
export function ProfileCard({
  title,
  name,
  avatar,
  onChangeName,
  onChangeAvatar,
  onEndEditing,
  placeholder,
  maxLength,
  nameLabel,
  hint = null,
  accent,
  headerRight,
  children,
}: ProfileCardProps) {
  const { t } = useTranslation();
  return (
    <View style={[styles.card, accent ? { borderColor: accent } : null]}>
      <View style={styles.titleRow}>
        <AppText variant="bodyStrong" style={styles.flex}>
          {title}
        </AppText>
        {headerRight}
      </View>
      <View style={styles.nameRow}>
        <View style={[styles.avatar, accent ? { backgroundColor: accent } : null]}>
          <Image source={AVATAR_SOURCES[avatar]} style={styles.avatarImg} />
        </View>
        <TextInput
          value={name}
          onChangeText={(value) => onChangeName(value.slice(0, maxLength))}
          onEndEditing={onEndEditing}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          maxLength={maxLength}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          accessibilityLabel={nameLabel}
          style={[
            styles.input,
            accent ? { borderColor: accent } : null,
            hint?.error && styles.inputError,
          ]}
        />
      </View>
      {hint ? (
        <AppText variant="caption" color={hint.error ? palette.coralDark : colors.textMuted}>
          {hint.text}
        </AppText>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.avatars}
      >
        {AVATAR_IDS.map((id) => (
          <Pressable
            key={id}
            onPress={() => {
              feedback.tap();
              onChangeAvatar(id);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: id === avatar }}
            accessibilityLabel={t('setup.a11yAvatar', { avatar: t(`setup.avatars.${id}`) })}
            style={[
              styles.choice,
              id === avatar && styles.choiceActive,
              id === avatar && accent ? { borderColor: accent } : null,
            ]}
          >
            <Image source={AVATAR_SOURCES[id]} style={styles.choiceImg} />
          </Pressable>
        ))}
      </ScrollView>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 3,
    borderColor: colors.surface,
    boxShadow: shadows.md,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
    // Browsers give text inputs an intrinsic width; without this the field can't
    // shrink to the row (CSS flex items default to min-width: auto).
    minWidth: 0,
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
