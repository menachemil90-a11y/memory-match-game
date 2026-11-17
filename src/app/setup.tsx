import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AVATAR_IDS, AVATAR_SOURCES, type AvatarId } from '@/features/boards/builtin';
import { useBoard } from '@/features/boards/useBoard';
import { startGame } from '@/features/game/startGame';
import {
  MAX_NAME_LENGTH,
  playerColor,
  sanitizeName,
  usePlayersStore,
  type PlayerColorId,
  type PlayerProfile,
} from '@/features/players/playersStore';
import { isLevelId } from '@/game';
import { feedback } from '@/lib/feedback';
import { AppText, Dialog, GameButton, Screen, Toggle } from '@/ui/components';
import { colors, fonts, minTouchTarget, radii, shadows, spacing, typography } from '@/ui/theme';

interface PlayerEditorProps {
  index: 0 | 1;
  profile: PlayerProfile;
  takenColor: PlayerColorId;
  onChange: (profile: PlayerProfile) => void;
}

function PlayerEditor({ index, profile, takenColor, onChange }: PlayerEditorProps) {
  const { t } = useTranslation();
  const color = playerColor(profile.color);

  return (
    <View style={[styles.card, { borderColor: color.main }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.bigAvatar, { backgroundColor: color.main }]}>
          <Image source={AVATAR_SOURCES[profile.avatar]} style={styles.bigAvatarImage} />
        </View>
        <View style={styles.flex}>
          <AppText variant="caption" color={colors.textMuted}>
            {t('common.playerN', { n: index + 1 })}
          </AppText>
          <TextInput
            value={profile.name}
            onChangeText={(name) => onChange({ ...profile, name: name.slice(0, MAX_NAME_LENGTH) })}
            onEndEditing={() => onChange({ ...profile, name: sanitizeName(profile.name) })}
            placeholder={t('setup.namePlaceholder', { n: index + 1 })}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={`${t('common.playerN', { n: index + 1 })} ${t('setup.nameLabel')}`}
            maxLength={MAX_NAME_LENGTH}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            style={[styles.input, { borderColor: color.main }]}
          />
        </View>
      </View>

      <AppText variant="caption" color={colors.textMuted}>
        {t('setup.avatar')}
      </AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {AVATAR_IDS.map((id: AvatarId) => {
          const selected = id === profile.avatar;
          return (
            <Pressable
              key={id}
              onPress={() => {
                feedback.tap();
                onChange({ ...profile, avatar: id });
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={t('setup.a11yAvatar', { avatar: t(`setup.avatars.${id}`) })}
              style={[
                styles.avatarChoice,
                selected && { borderColor: color.main, backgroundColor: colors.surfaceAlt },
              ]}
            >
              <Image source={AVATAR_SOURCES[id]} style={styles.avatarChoiceImage} />
            </Pressable>
          );
        })}
      </ScrollView>

      <AppText variant="caption" color={colors.textMuted}>
        {t('setup.color')}
      </AppText>
      <View style={styles.row}>
        {colors.players.map((c) => {
          const selected = c.id === profile.color;
          const taken = c.id === takenColor;
          return (
            <Pressable
              key={c.id}
              disabled={taken}
              onPress={() => {
                feedback.tap();
                onChange({ ...profile, color: c.id });
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: taken }}
              accessibilityLabel={t('setup.a11yColor', { color: t(`setup.colors.${c.id}`) })}
              style={[
                styles.swatch,
                { backgroundColor: c.main, opacity: taken ? 0.25 : 1 },
                selected && styles.swatchSelected,
              ]}
            >
              {selected ? <Ionicons name="checkmark" size={24} color={colors.textOnDark} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function PlayerSetupScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ boardId?: string; levelId?: string }>();
  const board = useBoard(params.boardId);
  const saved = usePlayersStore();
  const [players, setPlayers] = useState<[PlayerProfile, PlayerProfile]>(saved.local);
  const [tabletop, setTabletop] = useState(saved.tabletop);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const update = (index: 0 | 1) => (profile: PlayerProfile) =>
    setPlayers((prev) => {
      const next: [PlayerProfile, PlayerProfile] = [...prev];
      next[index] = profile;
      return next;
    });

  const start = async () => {
    if (!board || !isLevelId(params.levelId) || busy) return;
    const final = players.map((p) => ({ ...p, name: sanitizeName(p.name) })) as [
      PlayerProfile,
      PlayerProfile,
    ];
    saved.setLocalPlayer(0, final[0]);
    saved.setLocalPlayer(1, final[1]);
    saved.setTabletop(tabletop);
    setBusy(true);
    try {
      await startGame({ mode: 'local', board, levelId: params.levelId, players: final, tabletop });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={t('setup.title')} scroll>
      <View style={styles.list}>
        <PlayerEditor
          index={0}
          profile={players[0]}
          takenColor={players[1].color}
          onChange={update(0)}
        />
        <PlayerEditor
          index={1}
          profile={players[1]}
          takenColor={players[0].color}
          onChange={update(1)}
        />
        <View style={styles.card}>
          <Toggle
            label={t('setup.tabletop')}
            description={t('setup.tabletopHint')}
            value={tabletop}
            onValueChange={setTabletop}
          />
        </View>
        <GameButton
          label={t('setup.start')}
          icon="play"
          onPress={() => void start()}
          disabled={busy || !board}
        />
      </View>
      <Dialog visible={error} title={t('game.loadError')} onRequestClose={() => setError(false)}>
        <GameButton label={t('common.ok')} size="md" onPress={() => setError(false)} />
      </Dialog>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: spacing.lg, paddingBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 3,
    borderColor: colors.surface,
    boxShadow: shadows.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bigAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.card.border,
  },
  bigAvatarImage: { width: 44, height: 44 },
  input: {
    ...typography.heading,
    fontFamily: fonts.semibold,
    color: colors.text,
    borderWidth: 2,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: minTouchTarget,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  avatarChoice: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarChoiceImage: { width: 36, height: 36 },
  swatch: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: minTouchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  swatchSelected: { borderColor: colors.text },
});
