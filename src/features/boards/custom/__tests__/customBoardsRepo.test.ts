/** @jest-environment node */
import { createTestDb } from '@/lib/db/__tests__/nodeSqliteDb';
import { migrate } from '@/lib/db/migrations';

import { customBoardsRepo, type NewPhoto } from '../customBoardsRepo';

const photo = (id: string): NewPhoto => ({
  id,
  sourceFile: `${id}-src.jpg`,
  cardFile: `${id}-card-1.jpg`,
  thumbFile: `${id}-thumb-1.jpg`,
  sourceWidth: 1600,
  sourceHeight: 1200,
  crop: { rotation: 0, originX: 200, originY: 0, size: 1200 },
});

async function setup() {
  const db = createTestDb();
  await db.execAsync('PRAGMA foreign_keys = ON');
  await migrate(db);
  await customBoardsRepo.create(db, { id: 'b1', name: 'Grandma', cardBack: 'coral-dots' }, 1);
  await customBoardsRepo.addPhotos(db, 'b1', ['p1', 'p2', 'p3'].map(photo), 2);
  return db;
}

describe('customBoardsRepo', () => {
  it('creates boards and appends photos in order', async () => {
    const db = await setup();
    await customBoardsRepo.addPhotos(db, 'b1', [photo('p4')], 3);
    const board = await customBoardsRepo.get(db, 'b1');
    expect(board).toMatchObject({
      name: 'Grandma',
      cardBack: 'coral-dots',
      coverPhotoId: null,
      updatedAt: 3,
    });
    expect(board!.photos.map((p) => [p.id, p.position])).toEqual([
      ['p1', 0],
      ['p2', 1],
      ['p3', 2],
      ['p4', 3],
    ]);
    expect(board!.photos[0]!.crop).toEqual({ rotation: 0, originX: 200, originY: 0, size: 1200 });
  });

  it('renames, sets card back and cover', async () => {
    const db = await setup();
    await customBoardsRepo.rename(db, 'b1', 'Family');
    await customBoardsRepo.setCardBack(db, 'b1', 'night-stars');
    await customBoardsRepo.setCover(db, 'b1', 'p2');
    expect(await customBoardsRepo.get(db, 'b1')).toMatchObject({
      name: 'Family',
      cardBack: 'night-stars',
      coverPhotoId: 'p2',
    });
  });

  it('deletes a photo, closes the gap and clears the cover', async () => {
    const db = await setup();
    await customBoardsRepo.setCover(db, 'b1', 'p2');
    await customBoardsRepo.deletePhoto(db, 'b1', 'p2');
    const board = await customBoardsRepo.get(db, 'b1');
    expect(board!.photos.map((p) => [p.id, p.position])).toEqual([
      ['p1', 0],
      ['p3', 1],
    ]);
    expect(board!.coverPhotoId).toBeNull();
  });

  it('reorders photos one step at a time and ignores moves past the ends', async () => {
    const db = await setup();
    await customBoardsRepo.movePhoto(db, 'b1', 'p3', -1);
    await customBoardsRepo.movePhoto(db, 'b1', 'p1', -1);
    await customBoardsRepo.movePhoto(db, 'b1', 'p2', 1);
    const ids = async () => (await customBoardsRepo.get(db, 'b1'))!.photos.map((p) => p.id);
    expect(await ids()).toEqual(['p1', 'p3', 'p2']);
    await customBoardsRepo.movePhoto(db, 'b1', 'p3', 1);
    expect(await ids()).toEqual(['p1', 'p2', 'p3']);
  });

  it('updates a crop and file names', async () => {
    const db = await setup();
    await customBoardsRepo.updatePhoto(db, {
      id: 'p1',
      boardId: 'b1',
      crop: { rotation: 90, originX: 10, originY: 20, size: 500 },
      cardFile: 'p1-card-2.jpg',
      thumbFile: 'p1-thumb-2.jpg',
    });
    const p1 = (await customBoardsRepo.get(db, 'b1'))!.photos[0]!;
    expect(p1).toMatchObject({ cardFile: 'p1-card-2.jpg', crop: { rotation: 90, size: 500 } });
  });

  it('lists boards most recently updated first and removes everything on delete', async () => {
    const db = await setup();
    await customBoardsRepo.create(db, { id: 'b2', name: 'Pets', cardBack: 'grape-stars' }, 10);
    expect((await customBoardsRepo.list(db)).map((b) => [b.id, b.photos.length])).toEqual([
      ['b2', 0],
      ['b1', 3],
    ]);
    await db.runAsync(
      "INSERT INTO layout_history (board_id, level_id, hash, played_at) VALUES ('b1', 'tiny', 'h', 1)",
    );
    await customBoardsRepo.remove(db, 'b1');
    expect(await customBoardsRepo.get(db, 'b1')).toBeNull();
    const left = await db.getAllAsync<{ c: number }>(
      "SELECT COUNT(*) AS c FROM custom_photos WHERE board_id = 'b1'",
    );
    expect(left[0]!.c).toBe(0);
    const history = await db.getAllAsync<{ c: number }>(
      "SELECT COUNT(*) AS c FROM layout_history WHERE board_id = 'b1'",
    );
    expect(history[0]!.c).toBe(0);
  });
});
