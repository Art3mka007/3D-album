import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALBUM_STORAGE_KEY,
  SEED_ITEMS,
  calculateCaptureProgress,
  createAlbumItem,
  deleteAlbumItem,
  filterAlbumItems,
  formatRussianCount,
  formatRussianDate,
  loadAlbumItems,
  saveAlbumItems,
} from './albumStorage';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

test('loadAlbumItems seeds 3 demo items on empty storage', () => {
  const storage = createMemoryStorage();
  const items = loadAlbumItems(storage);
  assert.equal(items.length, 3);
  assert.equal(items[0].title, 'Старый Зенит');
  assert.equal(items[1].title, 'Любимые кеды');
  assert.equal(items[2].title, 'Авокадо-сувенир');
  assert.ok(storage.getItem(ALBUM_STORAGE_KEY));
});

test('filterAlbumItems matches Russian titles and notes case-insensitively', () => {
  assert.equal(filterAlbumItems(SEED_ITEMS, '').length, 3);
  assert.equal(filterAlbumItems(SEED_ITEMS, 'зенит').length, 1);
  assert.equal(filterAlbumItems(SEED_ITEMS, 'Петербург').length, 1);
  assert.equal(filterAlbumItems(SEED_ITEMS, 'несуществующий').length, 0);
});

test('createAlbumItem validates title and creates custom item', () => {
  assert.throws(() =>
    createAlbumItem({
      title: '   ',
      note: 'Заметка',
      coverUrl: 'data:image/png;base64,abc',
      source: 'camera',
    }),
  );

  const item = createAlbumItem({
    title: '  Винтажная кружка  ',
    note: '  Из поездки в Карелию  ',
    coverUrl: 'data:image/png;base64,abc',
    source: 'gallery',
    nowIso: '2026-11-13T12:00:00.000Z',
    id: 'test-1',
  });

  assert.equal(item.id, 'test-1');
  assert.equal(item.title, 'Винтажная кружка');
  assert.equal(item.note, 'Из поездки в Карелию');
  assert.equal(item.modelType, 'custom');
  assert.equal(item.source, 'gallery');
});

test('deleteAlbumItem removes target item and persists round-trip', () => {
  const storage = createMemoryStorage();
  const initial = loadAlbumItems(storage);
  const updated = deleteAlbumItem(initial, 'seed-zenit');
  assert.equal(updated.length, 2);
  assert.equal(saveAlbumItems(updated, storage), true);

  const reloaded = loadAlbumItems(storage);
  assert.equal(reloaded.length, 2);
  assert.equal(reloaded.some((i) => i.id === 'seed-zenit'), false);
});

test('Russian date, count formatting, and capture progress clamp cleanly', () => {
  assert.equal(formatRussianDate('2026-10-14T11:30:00.000Z'), '14 окт 2026');
  assert.equal(formatRussianCount(1), '1 вещь');
  assert.equal(formatRussianCount(3), '3 вещи');
  assert.equal(formatRussianCount(5), '5 вещей');
  assert.equal(formatRussianCount(21), '21 вещь');
  assert.equal(calculateCaptureProgress(-500, 10000), 0);
  assert.equal(calculateCaptureProgress(5000, 10000), 0.5);
  assert.equal(calculateCaptureProgress(15000, 10000), 1);
});
