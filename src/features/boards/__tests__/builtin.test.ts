import { LEVELS } from '@/game';

import { BUILTIN_BOARDS, CARD_BACK_IDS, CARD_BACK_SOURCES } from '../builtin';

describe('built-in boards', () => {
  it('ships 8 themed boards', () => {
    expect(BUILTIN_BOARDS.map((b) => b.id)).toEqual([
      'animals',
      'fruits',
      'vehicles',
      'ocean',
      'space',
      'dinosaurs',
      'food',
      'sports',
    ]);
  });

  it.each(BUILTIN_BOARDS.map((b) => [b.id, b] as const))(
    '%s has enough unique images for Expert and a valid card back',
    (_id, board) => {
      const maxPairs = Math.max(...LEVELS.map((l) => l.pairs));
      expect(board.images.length).toBeGreaterThanOrEqual(Math.max(maxPairs, 24));
      expect(new Set(board.images.map((i) => i.id)).size).toBe(board.images.length);
      expect(new Set(board.images.map((i) => i.label)).size).toBe(board.images.length);
      expect(CARD_BACK_IDS).toContain(board.cardBack);
      expect(board.images.some((i) => i.id === board.coverImageId)).toBe(true);
      for (const img of board.images) {
        expect(img.id.includes(',')).toBe(false);
        expect(img.background).toMatch(/^#[0-9A-F]{6}$/i);
      }
    },
  );

  it('has a source for every card back', () => {
    for (const id of CARD_BACK_IDS) expect(CARD_BACK_SOURCES[id]).toBeDefined();
  });
});
