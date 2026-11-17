import type { CARD_BACK_IDS } from './generated';

export type CardBackId = (typeof CARD_BACK_IDS)[number];

export interface BuiltinImageData {
  key: string;
  /** English label, announced by screen readers. */
  label: string;
  /** Card-face background (both cards of a pair share it). */
  background: string;
  /** Metro asset id (from require()). */
  source: number;
}

export interface BuiltinBoardData {
  id: string;
  cardBack: CardBackId;
  accent: string;
  images: readonly BuiltinImageData[];
}
