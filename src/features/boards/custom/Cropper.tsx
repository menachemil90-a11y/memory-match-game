import { Image } from 'expo-image';
import { useEffect, useImperativeHandle, useMemo, useState, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/ui/theme';

import {
  clampView,
  coverScale,
  cropFromView,
  nextRotation,
  rotatedSize,
  viewFromCrop,
  zoomAround,
  type CropParams,
  type Rotation,
  type Size,
} from './cropMath';

export interface CropperHandle {
  getCrop: () => CropParams;
  rotate: () => void;
  reset: () => void;
}

export interface CropperProps {
  uri: string;
  sourceSize: Size;
  initialCrop: CropParams;
  /** Inner (photo) size of the card in the cropper, in points. */
  viewport: number;
  /** Width of the whole cropper area (the dimmed photo shows around the card). */
  areaWidth: number;
  /** Size of the "in the game" preview card. */
  previewSize: number;
  handleRef: Ref<CropperHandle>;
}

/** Card border and corner radius, matching GameCard proportions. */
export function cardFrame(inner: number) {
  const border = Math.max(3, Math.round(inner * 0.06));
  const outer = inner + border * 2;
  return { border, outer, radius: Math.round(outer * 0.16) };
}

const MARGIN = 28;

function roundedRectPath(x: number, y: number, w: number, h: number, r: number) {
  return `M${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${y + r} V${y + h - r} A${r},${r} 0 0 1 ${x + w - r},${y + h} H${x + r} A${r},${r} 0 0 1 ${x},${y + h - r} V${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`;
}

/**
 * Full-screen square cropper: pinch to zoom (around the fingers), drag to
 * pan, rotate in 90° steps. The window looks exactly like the final card.
 */
export function Cropper({
  uri,
  sourceSize,
  initialCrop,
  viewport,
  areaWidth,
  previewSize,
  handleRef,
}: CropperProps) {
  const [rotation, setRotation] = useState<Rotation>(initialCrop.rotation);
  const rotated = rotatedSize(sourceSize, rotation);
  const initial = viewFromCrop(
    initialCrop,
    rotatedSize(sourceSize, initialCrop.rotation),
    viewport,
  );

  const zoom = useSharedValue(initial.zoom);
  const tx = useSharedValue(initial.tx);
  const ty = useSharedValue(initial.ty);
  const rw = useSharedValue(rotated.width);
  const rh = useSharedValue(rotated.height);

  useEffect(() => {
    rw.set(rotated.width);
    rh.set(rotated.height);
  }, [rotated.width, rotated.height, rw, rh]);

  const areaHeight = viewport + MARGIN * 2;
  const centerX = areaWidth / 2;
  const centerY = areaHeight / 2;

  const resetView = (animated: boolean) => {
    const target = { zoom: 1, tx: 0, ty: 0 };
    if (animated) {
      zoom.set(withTiming(target.zoom, { duration: 200 }));
      tx.set(withTiming(target.tx, { duration: 200 }));
      ty.set(withTiming(target.ty, { duration: 200 }));
    } else {
      zoom.set(target.zoom);
      tx.set(target.tx);
      ty.set(target.ty);
    }
  };

  useImperativeHandle(
    handleRef,
    () => ({
      getCrop: () => ({
        rotation,
        ...cropFromView({ zoom: zoom.get(), tx: tx.get(), ty: ty.get() }, rotated, viewport),
      }),
      rotate: () => {
        setRotation((r) => nextRotation(r));
        resetView(false);
      },
      reset: () => resetView(true),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rotation, rotated.width, rotated.height, viewport],
  );

  const gesture = useMemo(() => {
    const size = () => {
      'worklet';
      return { width: rw.value, height: rh.value };
    };
    const pinch = Gesture.Pinch().onChange((e) => {
      'worklet';
      const next = clampView(
        zoomAround(
          { zoom: zoom.value, tx: tx.value, ty: ty.value },
          e.scaleChange,
          e.focalX - centerX,
          e.focalY - centerY,
        ),
        size(),
        viewport,
      );
      zoom.set(next.zoom);
      tx.set(next.tx);
      ty.set(next.ty);
    });
    const pan = Gesture.Pan()
      .averageTouches(true)
      .onChange((e) => {
        'worklet';
        const next = clampView(
          { zoom: zoom.value, tx: tx.value + e.changeX, ty: ty.value + e.changeY },
          size(),
          viewport,
        );
        tx.set(next.tx);
        ty.set(next.ty);
      });
    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((_e, success) => {
        'worklet';
        if (!success) return;
        const target = zoom.value > 1.05 ? 1 : 2;
        const next = clampView(
          {
            zoom: target,
            tx: tx.value * (target / zoom.value),
            ty: ty.value * (target / zoom.value),
          },
          size(),
          viewport,
        );
        zoom.set(withTiming(next.zoom, { duration: 220 }));
        tx.set(withTiming(next.tx, { duration: 220 }));
        ty.set(withTiming(next.ty, { duration: 220 }));
      });
    return Gesture.Simultaneous(pinch, pan, doubleTap);
  }, [centerX, centerY, viewport, zoom, tx, ty, rw, rh]);

  // The image is laid out at "cover" scale and centered; zoom/pan/rotate are transforms.
  const base = coverScale(rotated, viewport);
  const imgW = sourceSize.width * base;
  const imgH = sourceSize.height * base;

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: zoom.value },
      { rotate: `${rotation}deg` },
    ],
  }));

  const k = previewSize / viewport;
  const previewStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value * k },
      { translateY: ty.value * k },
      { scale: zoom.value },
      { rotate: `${rotation}deg` },
    ],
  }));

  const frame = cardFrame(viewport);
  const holeX = centerX - viewport / 2;
  const holeY = centerY - viewport / 2;
  const innerRadius = Math.max(0, frame.radius - frame.border);
  const mask = `M0,0 H${areaWidth} V${areaHeight} H0 Z ${roundedRectPath(holeX, holeY, viewport, viewport, innerRadius)}`;
  const preview = cardFrame(previewSize);

  return (
    <View style={styles.wrap}>
      <GestureDetector gesture={gesture}>
        <View style={[styles.area, { width: areaWidth, height: areaHeight }]} collapsable={false}>
          <Animated.View
            style={[
              styles.image,
              { width: imgW, height: imgH, left: centerX - imgW / 2, top: centerY - imgH / 2 },
              imageStyle,
            ]}
          >
            <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="fill" />
          </Animated.View>
          <Svg
            width={areaWidth}
            height={areaHeight}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          >
            <Path d={mask} fill="rgba(25, 14, 70, 0.62)" fillRule="evenodd" />
          </Svg>
          <View
            pointerEvents="none"
            style={[
              styles.frame,
              {
                left: holeX - frame.border,
                top: holeY - frame.border,
                width: frame.outer,
                height: frame.outer,
                borderRadius: frame.radius,
                borderWidth: frame.border,
              },
            ]}
          />
        </View>
      </GestureDetector>

      <View
        style={[
          styles.previewCard,
          {
            width: preview.outer,
            height: preview.outer,
            borderRadius: preview.radius,
            borderWidth: preview.border,
          },
        ]}
        accessible={false}
      >
        <Animated.View
          style={[
            styles.image,
            {
              width: imgW * k,
              height: imgH * k,
              left: previewSize / 2 - (imgW * k) / 2,
              top: previewSize / 2 - (imgH * k) / 2,
            },
            previewStyle,
          ]}
        >
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="fill" />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  area: { overflow: 'hidden' },
  image: { position: 'absolute' },
  frame: {
    position: 'absolute',
    borderColor: colors.card.border,
    boxShadow: '0px 6px 18px rgba(0,0,0,0.35)',
  },
  previewCard: {
    overflow: 'hidden',
    borderColor: colors.card.border,
    backgroundColor: colors.surface,
    boxShadow: '0px 3px 8px rgba(30,18,80,0.3)',
  },
});
