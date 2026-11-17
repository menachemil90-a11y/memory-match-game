/** @jest-environment node */
import { LEVELS } from '@/game';
import { minTouchTarget } from '@/ui/theme/tokens';

import { MAX_CARD_SIZE, cardPosition, computeGridLayout } from '../gridLayout';

// Grid area on a small 360×640dp Android phone with the 2-player panels (~ 344 × 400).
const SMALL_PHONE = { w: 344, h: 400 };
const TABLET = { w: 1000, h: 1100 };

describe('computeGridLayout', () => {
  it.each(LEVELS.map((l) => [l.id, l] as const))(
    '%s fits and stays tappable on a small phone',
    (_id, level) => {
      const g = computeGridLayout(SMALL_PHONE.w, SMALL_PHONE.h, level.cols, level.rows);
      expect(g.width).toBeLessThanOrEqual(SMALL_PHONE.w);
      expect(g.height).toBeLessThanOrEqual(SMALL_PHONE.h);
      expect(g.cardSize).toBeGreaterThanOrEqual(minTouchTarget);
    },
  );

  it('caps the card size on tablets and centers the grid', () => {
    const g = computeGridLayout(TABLET.w, TABLET.h, 2, 3);
    expect(g.cardSize).toBe(MAX_CARD_SIZE);
    expect(g.offsetX).toBeGreaterThan(0);
    expect(g.offsetY).toBeGreaterThan(0);
    expect(g.offsetX * 2 + g.width).toBeCloseTo(TABLET.w, -1);
  });

  it('never overlaps cards', () => {
    const g = computeGridLayout(360, 500, 4, 5);
    const a = cardPosition(g, 4, 0);
    const b = cardPosition(g, 4, 1);
    const c = cardPosition(g, 4, 4);
    expect(b.x - a.x).toBe(g.cardSize + g.gap);
    expect(c.y - a.y).toBe(g.cardSize + g.gap);
    expect(g.gap).toBeGreaterThanOrEqual(6);
  });

  it('handles zero-size containers', () => {
    expect(computeGridLayout(0, 0, 6, 6).cardSize).toBe(0);
  });
});
