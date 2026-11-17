/**
 * Pure crop geometry for the square card cropper. All functions are worklets
 * so they also run on the UI thread during pinch/pan gestures.
 *
 * Coordinates: the source image is rotated by `rotation` first; crop rects are
 * in pixels of that rotated image. The view state is what the cropper shows:
 * `zoom` ≥ 1 relative to "cover" scale, and a translation in viewport points.
 */

export type Rotation = 0 | 90 | 180 | 270;

export interface Size {
  width: number;
  height: number;
}

export interface CropRect {
  originX: number;
  originY: number;
  size: number;
}

export interface CropParams extends CropRect {
  rotation: Rotation;
}

export interface ViewState {
  zoom: number;
  tx: number;
  ty: number;
}

export const MAX_ZOOM = 6;

export function nextRotation(rotation: Rotation): Rotation {
  'worklet';
  return ((rotation + 90) % 360) as Rotation;
}

export function rotatedSize(source: Size, rotation: Rotation): Size {
  'worklet';
  return rotation === 90 || rotation === 270
    ? { width: source.height, height: source.width }
    : { width: source.width, height: source.height };
}

/** Scale at which the image exactly covers the square viewport (zoom = 1). */
export function coverScale(rotated: Size, viewport: number): number {
  'worklet';
  return viewport / Math.min(rotated.width, rotated.height);
}

/** Keeps zoom in range and the viewport fully covered by the image. */
export function clampView(view: ViewState, rotated: Size, viewport: number): ViewState {
  'worklet';
  const zoom = Math.min(MAX_ZOOM, Math.max(1, view.zoom));
  const scale = coverScale(rotated, viewport) * zoom;
  const maxX = Math.max(0, (rotated.width * scale - viewport) / 2);
  const maxY = Math.max(0, (rotated.height * scale - viewport) / 2);
  return {
    zoom,
    tx: Math.min(maxX, Math.max(-maxX, view.tx)),
    ty: Math.min(maxY, Math.max(-maxY, view.ty)),
  };
}

/** Zooms by `factor` around a focal point (relative to the viewport center). */
export function zoomAround(
  view: ViewState,
  factor: number,
  focalX: number,
  focalY: number,
): ViewState {
  'worklet';
  return {
    zoom: view.zoom * factor,
    tx: focalX - (focalX - view.tx) * factor,
    ty: focalY - (focalY - view.ty) * factor,
  };
}

/** The crop rect (rotated-image pixels) that the viewport currently shows. */
export function cropFromView(view: ViewState, rotated: Size, viewport: number): CropRect {
  'worklet';
  const v = clampView(view, rotated, viewport);
  const scale = coverScale(rotated, viewport) * v.zoom;
  const size = Math.min(viewport / scale, rotated.width, rotated.height);
  const cx = rotated.width / 2 - v.tx / scale;
  const cy = rotated.height / 2 - v.ty / scale;
  return {
    originX: Math.min(rotated.width - size, Math.max(0, cx - size / 2)),
    originY: Math.min(rotated.height - size, Math.max(0, cy - size / 2)),
    size,
  };
}

/** Inverse of `cropFromView`: restores the view for a saved crop (re-crop later). */
export function viewFromCrop(crop: CropRect, rotated: Size, viewport: number): ViewState {
  'worklet';
  const zoom = Math.min(rotated.width, rotated.height) / crop.size;
  const scale = coverScale(rotated, viewport) * zoom;
  const cx = crop.originX + crop.size / 2;
  const cy = crop.originY + crop.size / 2;
  return clampView(
    { zoom, tx: (rotated.width / 2 - cx) * scale, ty: (rotated.height / 2 - cy) * scale },
    rotated,
    viewport,
  );
}

/** The automatic crop: the largest centered square. */
export function centerCrop(rotated: Size): CropRect {
  'worklet';
  const size = Math.min(rotated.width, rotated.height);
  return {
    originX: (rotated.width - size) / 2,
    originY: (rotated.height - size) / 2,
    size,
  };
}

/** Integer pixel rect, safely inside the image (for the image manipulator). */
export function toPixelRect(crop: CropRect, rotated: Size) {
  const size = Math.max(1, Math.floor(Math.min(crop.size, rotated.width, rotated.height)));
  const originX = Math.min(rotated.width - size, Math.max(0, Math.round(crop.originX)));
  const originY = Math.min(rotated.height - size, Math.max(0, Math.round(crop.originY)));
  return { originX, originY, width: size, height: size };
}
