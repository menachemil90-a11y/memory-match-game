import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Pressable3D } from '@/ui/components';
import { colors, radii, spacing } from '@/ui/theme';

import { CARD_BACK_SOURCES } from '../builtin';
import type { Board, BoardImage } from '../types';
import { useBoardName } from '../useBoard';

function MiniFace({ image, rotate, size }: { image: BoardImage; rotate: number; size: number }) {
  return (
    <View
      style={[
        styles.mini,
        {
          width: size,
          height: size,
          borderRadius: size * 0.18,
          backgroundColor: image.kind === 'art' ? image.background : colors.surface,
          transform: [{ rotate: `${rotate}deg` }],
        },
      ]}
    >
      <Image
        source={image.source}
        style={
          image.kind === 'art'
            ? { width: size * 0.68, height: size * 0.68 }
            : StyleSheet.absoluteFill
        }
        contentFit={image.kind === 'art' ? 'contain' : 'cover'}
      />
    </View>
  );
}

export interface BoardTileProps {
  board: Board;
  width: number;
  onPress: () => void;
  onLongPress?: () => void;
}

/** A board "box": its card back as the lid with three fanned cards on top. */
export function BoardTile({ board, width, onPress, onLongPress }: BoardTileProps) {
  const { t } = useTranslation();
  const name = useBoardName(board);
  const cover = board.images.find((i) => i.id === board.coverImageId) ?? board.images[0];
  const others = board.images.filter((i) => i.id !== cover?.id).slice(0, 2);
  const fan = cover ? [others[0], cover, others[1]].filter((i): i is BoardImage => !!i) : others;
  const art = width * 0.36;
  const count =
    board.kind === 'custom'
      ? t('boards.photos', { count: board.images.length })
      : t('boards.images', { count: board.images.length });

  return (
    <Pressable3D
      onPress={onPress}
      onLongPress={onLongPress}
      edgeColor="rgba(30,18,80,0.35)"
      radius={radii.xl}
      style={{ width }}
      faceStyle={styles.face}
      accessibilityLabel={`${name}, ${count}`}
    >
      <View style={[styles.lid, { height: width * 0.7 }]}>
        <Image
          source={CARD_BACK_SOURCES[board.cardBack]}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
        <View style={styles.fan}>
          {fan.map((img, i) => (
            <View
              key={img.id}
              style={[
                styles.fanSlot,
                {
                  marginHorizontal: -art * 0.16,
                  zIndex: i === 1 ? 2 : 1,
                  marginTop: i === 1 ? 0 : art * 0.18,
                },
              ]}
            >
              <MiniFace
                image={img}
                rotate={(i - 1) * 12}
                size={i === 1 ? art * 1.08 : art * 0.92}
              />
            </View>
          ))}
        </View>
      </View>
      <View style={styles.label}>
        {/* Shrinks long names ("Yummy Food") on very narrow phones instead of cutting them. */}
        <AppText variant="heading" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          {name}
        </AppText>
        <AppText variant="caption" color={colors.textMuted}>
          {count}
        </AppText>
      </View>
    </Pressable3D>
  );
}

const styles = StyleSheet.create({
  face: {
    backgroundColor: colors.surface,
    borderWidth: 4,
    borderColor: colors.card.border,
  },
  lid: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  fan: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center' },
  fanSlot: {},
  mini: {
    borderWidth: 3,
    borderColor: colors.card.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: '0px 3px 6px rgba(30,18,80,0.3)',
  },
  label: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
});
