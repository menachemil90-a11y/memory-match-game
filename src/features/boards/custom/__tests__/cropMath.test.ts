/** @jest-environment node */
import {
  MAX_ZOOM,
  centerCrop,
  clampView,
  coverScale,
  cropFromView,
  nextRotation,
  rotatedSize,
  toPixelRect,
  viewFromCrop,
  zoomAround,
} from '../cropMath';

const LANDSCAPE = { width: 1600, height: 1200 };
const V = 300;

describe('crop math', () => {
  it('rotates sizes and cycles rotations', () => {
    expect(rotatedSize(LANDSCAPE, 90)).toEqual({ width: 1200, height: 1600 });
    expect(rotatedSize(LANDSCAPE, 180)).toEqual(LANDSCAPE);
    expect([0, 90, 180, 270].map((r) => nextRotation(r as 0))).toEqual([90, 180, 270, 0]);
  });

  it('auto-crops the largest centered square', () => {
    expect(centerCrop(LANDSCAPE)).toEqual({ originX: 200, originY: 0, size: 1200 });
    expect(centerCrop({ width: 900, height: 1600 })).toEqual({
      originX: 0,
      originY: 350,
      size: 900,
    });
  });

  it('the default view equals the auto crop', () => {
    expect(cropFromView({ zoom: 1, tx: 0, ty: 0 }, LANDSCAPE, V)).toEqual(centerCrop(LANDSCAPE));
  });

  it('never lets the image leave a gap in the viewport', () => {
    const v = clampView({ zoom: 1, tx: 9999, ty: 9999 }, LANDSCAPE, V);
    expect(v.ty).toBe(0); // height exactly covers at zoom 1
    expect(v.tx).toBeCloseTo((1600 * coverScale(LANDSCAPE, V) - V) / 2);
    const crop = cropFromView(v, LANDSCAPE, V);
    expect(crop.originX).toBeCloseTo(0);
  });

  it('clamps zoom between 1 and MAX_ZOOM', () => {
    expect(clampView({ zoom: 0.2, tx: 0, ty: 0 }, LANDSCAPE, V).zoom).toBe(1);
    expect(clampView({ zoom: 50, tx: 0, ty: 0 }, LANDSCAPE, V).zoom).toBe(MAX_ZOOM);
  });

  it('zooming in shrinks the crop around the same center', () => {
    const crop = cropFromView({ zoom: 2, tx: 0, ty: 0 }, LANDSCAPE, V);
    expect(crop.size).toBeCloseTo(600);
    expect(crop.originX + crop.size / 2).toBeCloseTo(800);
    expect(crop.originY + crop.size / 2).toBeCloseTo(600);
  });

  it('zooming around a focal point keeps that point fixed', () => {
    const before = { zoom: 1, tx: 0, ty: 0 };
    const after = zoomAround(before, 2, 60, -30);
    const s0 = coverScale(LANDSCAPE, V);
    // Image point under the focal point before and after:
    const px = (f: number, v: typeof before) => (f - v.tx) / (s0 * v.zoom);
    expect(px(60, after)).toBeCloseTo(px(60, before));
    expect(px(-30, { ...after, tx: after.ty })).toBeCloseTo(px(-30, { ...before, tx: before.ty }));
  });

  it('round-trips crop → view → crop (for re-cropping later)', () => {
    for (const rotation of [0, 90] as const) {
      const rotated = rotatedSize(LANDSCAPE, rotation);
      const crop = { originX: 120, originY: 260, size: 640 };
      const view = viewFromCrop(crop, rotated, V);
      const back = cropFromView(view, rotated, V);
      expect(back.originX).toBeCloseTo(crop.originX, 5);
      expect(back.originY).toBeCloseTo(crop.originY, 5);
      expect(back.size).toBeCloseTo(crop.size, 5);
    }
  });

  it('produces integer pixel rects inside the image', () => {
    const rect = toPixelRect({ originX: 1000.6, originY: -3, size: 700.4 }, LANDSCAPE);
    expect(rect).toEqual({ originX: 900, originY: 0, width: 700, height: 700 });
    expect(rect.originX + rect.width).toBeLessThanOrEqual(1600);
  });
});
