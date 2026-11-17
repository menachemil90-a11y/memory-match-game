export interface GridLayout {
  cardSize: number;
  gap: number;
  /** Offset of the grid inside the container (centered). */
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

/** Cards never grow beyond this (dp), so tablets show a comfortable, centered table. */
export const MAX_CARD_SIZE = 170;
/** Gap between cards as a fraction of card size. */
export const GAP_RATIO = 0.1;
export const MIN_GAP = 6;

/**
 * Largest square card that fits `cols × rows` cards (with gaps) into the
 * available area. Pure, so it is unit-tested for small phones and tablets.
 */
export function computeGridLayout(
  availableWidth: number,
  availableHeight: number,
  cols: number,
  rows: number,
): GridLayout {
  const w = Math.max(0, availableWidth);
  const h = Math.max(0, availableHeight);
  // size·n + gap·(n-1) ≤ available, gap = max(MIN_GAP, size·GAP_RATIO)
  const fit = (avail: number, n: number) => {
    const proportional = avail / (n + GAP_RATIO * (n - 1));
    const withMinGap = (avail - MIN_GAP * (n - 1)) / n;
    return proportional * GAP_RATIO >= MIN_GAP ? proportional : withMinGap;
  };
  let cardSize = Math.max(0, Math.floor(Math.min(fit(w, cols), fit(h, rows), MAX_CARD_SIZE)));
  const gapFor = (size: number) => Math.max(MIN_GAP, Math.round(size * GAP_RATIO));
  const overflows = (size: number) =>
    size * cols + gapFor(size) * (cols - 1) > w || size * rows + gapFor(size) * (rows - 1) > h;
  while (cardSize > 0 && overflows(cardSize)) cardSize--;
  const gap = gapFor(cardSize);
  const width = cardSize * cols + gap * (cols - 1);
  const height = cardSize * rows + gap * (rows - 1);
  return {
    cardSize,
    gap,
    width,
    height,
    offsetX: Math.max(0, Math.round((w - width) / 2)),
    offsetY: Math.max(0, Math.round((h - height) / 2)),
  };
}

/** Top-left position of the card at `index` (row-major), relative to the grid container. */
export function cardPosition(layout: GridLayout, cols: number, index: number) {
  const col = index % cols;
  const row = Math.floor(index / cols);
  return {
    x: layout.offsetX + col * (layout.cardSize + layout.gap),
    y: layout.offsetY + row * (layout.cardSize + layout.gap),
  };
}
