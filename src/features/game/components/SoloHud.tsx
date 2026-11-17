import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/ui/components';
import { colors, radii, spacing } from '@/ui/theme';

import { formatDuration } from '../format';

export interface SoloHudProps {
  moves: number;
  pairsFound: number;
  pairsTotal: number;
  /** Returns elapsed play time in ms (read every tick). */
  getElapsed: () => number;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="caption" color={colors.textOnDarkMuted} align="center">
        {label}
      </AppText>
      <AppText variant="heading" color={colors.textOnDark} align="center">
        {value}
      </AppText>
    </View>
  );
}

export function SoloHud({ moves, pairsFound, pairsTotal, getElapsed }: SoloHudProps) {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(getElapsed());
  useEffect(() => {
    const id = setInterval(() => setElapsed(getElapsed()), 250);
    return () => clearInterval(id);
  }, [getElapsed]);

  return (
    <View style={styles.hud}>
      <Stat label={t('game.moves')} value={String(moves)} />
      <Stat label={t('game.time')} value={formatDuration(elapsed)} />
      <Stat label={t('game.pairs')} value={`${pairsFound}/${pairsTotal}`} />
    </View>
  );
}

const styles = StyleSheet.create({
  hud: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(30,18,80,0.28)',
    borderRadius: radii.xl,
    paddingVertical: spacing.xs,
  },
  stat: { flex: 1 },
});
