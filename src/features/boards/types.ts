import type { ImageId } from '@/game';

import type { CardBackId } from './builtin/types';

export type { CardBackId } from './builtin/types';

/** A local bundled asset (require() id) or a file/remote URI. */
export type ImageSource = number | { uri: string };

export interface BoardImage {
  id: ImageId;
  /** Accessible name announced for the face of the card. */
  label: string;
  source: ImageSource;
  /** 'art' = illustration on a colored background, 'photo' = full-bleed photo. */
  kind: 'art' | 'photo';
  /** Face background color (art only). */
  background: string;
}

export interface Board {
  id: string;
  kind: 'builtin' | 'custom';
  /** Display name for custom boards; built-in names come from i18n. */
  name: string | null;
  cardBack: CardBackId;
  accent: string;
  coverImageId: ImageId;
  images: readonly BoardImage[];
}
