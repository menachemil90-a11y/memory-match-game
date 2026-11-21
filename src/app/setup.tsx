import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useBoard } from '@/features/boards/useBoard';
import { startGame } from '@/features/game/startGame';
import { ProfileCard } from '@/features/players/components/ProfileCard';
import {
  MAX_NAME_LENGTH,
  newPlayerProfile,
  playerColor,
  sanitizeName,
  usePlayersStore,
  type PlayerProfile,
} from '@/features/players/playersStore';
import { MAX_PLAYERS, MIN_MULTIPLAYER, isLevelId, maxPlayersForLevel } from '@/game';
import { feedback } from '@/lib/feedback';
import { AppText, Dialog, GameButton, IconButton, Screen, Toggle } from '@/ui/components';
import { colors, minTouchTarget, radii, shadows, spacing } from '@/ui/theme';

function ColorRow({
  profile,
  taken,
  onChange,
}: {
  profile: PlayerProfile;
  /** Colors of the other players (each color belongs to one player). */
  taken: ReadonlySet<string>;
  onChange: (profile: PlayerProfile) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <AppText variant="caption" color={colors.textMuted}>
        {t('setup.color')}
      </AppText>
      <View style={styles.row}>
        {colors.players.map((c) => {
          const selected = c.id === profile.color;
          const isTaken = taken.has(c.id);
          return (
            <Pressable
              key={c.id}
              disabled={isTaken}
              onPress={() => {
                feedback.tap();
                onChange({ ...profile, color: c.id });
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: isTaken }}
              accessibilityLabel={t('setup.a11yColor', { color: t(`setup.colors.${c.id}`) })}
              style={[
                styles.swatch,
                { backgroundColor: c.main, opacity: isTaken ? 0.25 : 1 },
                selected && styles.swatchSelected,
              ]}
            >
              {selected ? <Ionicons name="checkmark" size={24} color={colors.textOnDark} /> : null}
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

/**
 * Who is playing on this phone: 2–8 players, a name, avatar and color each
 * (remembered for next time). Then the board and the level — or, when opened
 * for a chosen board and level, straight into the game.
 */
export default function PlayerSetupScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ boardId?: string; levelId?: string }>();
  const board = useBoard(params.boardId);
  const levelId = isLevelId(params.levelId) ? params.levelId : null;
  const saved = usePlayersStore();
  // A level chosen before setup caps the group (bigger groups need bigger boards).
  const maxPlayers = levelId ? maxPlayersForLevel(levelId) : MAX_PLAYERS;
  const [players, setPlayers] = useState<PlayerProfile[]>(() => saved.local.slice(0, maxPlayers));
  const [tabletop, setTabletop] = useState(saved.tabletop);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const update = (index: number, profile: PlayerProfile) =>
    setPlayers((prev) => prev.map((p, i) => (i === index ? profile : p)));
  const add = () => {
    feedback.tap();
    setPlayers((prev) => (prev.length < maxPlayers ? [...prev, newPlayerProfile(prev)] : prev));
  };
  const remove = (index: number) => {
    feedback.tap();
    setPlayers((prev) =>
      prev.length > MIN_MULTIPLAYER ? prev.filter((_, i) => i !== index) : prev,
    );
  };
  const twoPlayers = players.length === 2;

  const next = async () => {
    if (busy) return;
    const final = players.map((p) => ({ ...p, name: sanitizeName(p.name) }));
    saved.setLocalPlayers(final);
    saved.setTabletop(tabletop);
    if (!board) {
      router.push({ pathname: '/boards', params: { mode: 'local' } });
      return;
    }
    if (!levelId) {
      router.push({ pathname: '/levels', params: { mode: 'local', boardId: board.id } });
      return;
    }
    setBusy(true);
    try {
      await startGame({
        mode: 'local',
        board,
        levelId,
        players: final,
        tabletop: twoPlayers && tabletop,
      });
    } catch (e) {
      console.error('Starting a game failed', e);
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={t('setup.title')} scroll>
      <View style={styles.list}>
        <AppText variant="heading" color={colors.textOnDark} accessibilityRole="header">
          {t('setup.count', { count: players.length })}
        </AppText>
        {players.map((profile, index) => {
          const playerN = t('common.playerN', { n: index + 1 });
          return (
            <ProfileCard
              // Colors are unique within the group, so they identify the player.
              key={profile.color}
              title={playerN}
              name={profile.name}
              avatar={profile.avatar}
              onChangeName={(name) => update(index, { ...profile, name })}
              onChangeAvatar={(avatar) => update(index, { ...profile, avatar })}
              onEndEditing={() => update(index, { ...profile, name: sanitizeName(profile.name) })}
              placeholder={t('setup.namePlaceholder', { n: index + 1 })}
              maxLength={MAX_NAME_LENGTH}
              nameLabel={`${playerN} ${t('setup.nameLabel')}`}
              accent={playerColor(profile.color).main}
              headerRight={
                players.length > MIN_MULTIPLAYER ? (
                  <IconButton
                    icon="close"
                    size={minTouchTarget}
                    accessibilityLabel={t('setup.remove', { player: playerN })}
                    onPress={() => remove(index)}
                  />
                ) : null
              }
            >
              <ColorRow
                profile={profile}
                taken={new Set(players.filter((_, i) => i !== index).map((p) => p.color))}
                onChange={(p) => update(index, p)}
              />
            </ProfileCard>
          );
        })}

        <View style={styles.addCard}>
          <GameButton
            label={t('setup.addPlayer')}
            icon="person-add"
            variant="info"
            size="md"
            onPress={add}
            disabled={players.length >= maxPlayers}
          />
          <AppText variant="caption" color={colors.textMuted} align="center">
            {players.length < maxPlayers
              ? t('setup.addHint', { max: maxPlayers })
              : levelId && maxPlayers < MAX_PLAYERS
                ? t('setup.levelFull', {
                    level: t(`levels.names.${levelId}`),
                    count: maxPlayers,
                  })
                : t('setup.groupFull', { count: maxPlayers })}
          </AppText>
        </View>

        {twoPlayers ? (
          <View style={styles.card}>
            <Toggle
              label={t('setup.tabletop')}
              description={t('setup.tabletopHint')}
              value={tabletop}
              onValueChange={setTabletop}
            />
          </View>
        ) : null}
        <GameButton
          label={
            board && levelId
              ? t('setup.start')
              : board
                ? t('setup.chooseLevel')
                : t('setup.chooseBoard')
          }
          icon={board && levelId ? 'play' : 'arrow-forward'}
          onPress={() => void next()}
          disabled={busy || (params.boardId !== undefined && !board)}
        />
      </View>
      <Dialog visible={error} title={t('game.loadError')} onRequestClose={() => setError(false)}>
        <GameButton label={t('common.ok')} size="md" onPress={() => setError(false)} />
      </Dialog>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.lg, paddingBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    boxShadow: shadows.md,
  },
  addCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    boxShadow: shadows.md,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
