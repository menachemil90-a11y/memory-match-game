import { Canvas, Picture, Skia, createPicture } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import {
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';

import { secureRandom } from '@/lib/secureRandom';
import { palette } from '@/ui/theme';

const COLORS = [
  palette.sun,
  palette.coral,
  palette.sky,
  palette.mint,
  palette.grapeLight,
  palette.tangerine,
];
const DURATION_MS = 4200;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  spin: number;
  wobble: number;
  color: number;
  round: boolean;
}

const rand = (min: number, max: number) =>
  min + (secureRandom.nextInt(10_000) / 10_000) * (max - min);

export interface ConfettiProps {
  count?: number;
}

/**
 * Celebration confetti drawn with Skia on the UI thread: one picture per
 * frame, so hundreds of pieces stay smooth on low-end phones.
 */
export function Confetti({ count = 140 }: ConfettiProps) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const time = useSharedValue(0);

  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: count }, (_, i) => {
        const fromLeft = i % 2 === 0;
        return {
          x: fromLeft ? rand(-20, width * 0.15) : rand(width * 0.85, width + 20),
          y: rand(height * 0.55, height * 0.8),
          vx: (fromLeft ? 1 : -1) * rand(80, 340),
          vy: -rand(700, 1250),
          size: rand(7, 13),
          spin: rand(-8, 8),
          wobble: rand(0, Math.PI * 2),
          color: i % COLORS.length,
          round: i % 5 === 0,
        };
      }),
    [count, width, height],
  );
  const paints = useMemo(
    () =>
      COLORS.map((c) => {
        const p = Skia.Paint();
        p.setColor(Skia.Color(c));
        p.setAntiAlias(true);
        return p;
      }),
    [],
  );

  const frame = useFrameCallback((info) => {
    time.set(Math.min(DURATION_MS, time.value + (info.timeSincePreviousFrame ?? 16)));
  }, false);

  useEffect(() => {
    if (reduceMotion) return;
    frame.setActive(true);
    return () => frame.setActive(false);
  }, [frame, reduceMotion]);

  const picture = useDerivedValue(() => {
    const t = time.value / 1000;
    const fade = Math.max(0, 1 - Math.max(0, time.value - DURATION_MS + 900) / 900);
    return createPicture((canvas) => {
      for (const p of particles) {
        const drag = 1 - Math.min(0.6, t * 0.25);
        const x = p.x + p.vx * t * drag + Math.sin(t * 6 + p.wobble) * 14;
        const y = p.y + p.vy * t + 900 * t * t;
        if (y > height + 30) continue;
        const paint = paints[p.color]!;
        paint.setAlphaf(fade);
        canvas.save();
        canvas.translate(x, y);
        canvas.rotate((t * p.spin * 57.3) % 360, 0, 0);
        if (p.round) canvas.drawCircle(0, 0, p.size * 0.45, paint);
        else canvas.drawRect(Skia.XYWHRect(-p.size / 2, -p.size / 4, p.size, p.size / 2), paint);
        canvas.restore();
      }
    });
  });

  if (reduceMotion) return null;
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  );
}
