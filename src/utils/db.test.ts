import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPTURE_STEPS, type CapturedViewFrame } from '../types/album';
import { createAlbumItem } from './albumStorage';
import { dbDeleteItem, dbGetAllItems, dbPutItem, dbPutManyItems } from './db';

function makeDummyViews(prefix: string): CapturedViewFrame[] {
  return CAPTURE_STEPS.map((step) => ({
    stepIndex: step.index,
    shortLabel: step.shortLabel,
    yawDeg: step.yawDeg,
    tiltDeg: step.tiltDeg,
    dataUrl: `data:image/jpeg;base64,${prefix}-${step.index}`,
  }));
}

test('db memory fallback supports batch seed, put, sorted getAll, and delete for 9-angle items', async () => {
  const a = createAlbumItem({
    id: 'db-1',
    title: 'Первый',
    note: '',
    views: makeDummyViews('v1'),
    source: 'demo',
    nowIso: '2026-01-01T10:00:00.000Z',
  });
  const b = createAlbumItem({
    id: 'db-2',
    title: 'Второй',
    note: '',
    views: makeDummyViews('v2'),
    source: 'camera',
    nowIso: '2026-02-01T10:00:00.000Z',
  });

  await dbPutManyItems([a]);
  await dbPutItem(b);

  const list = await dbGetAllItems();
  assert.equal(list.length, 2);
  assert.equal(list[0].id, 'db-2');
  assert.equal(list[1].id, 'db-1');
  assert.equal(list[0].views.length, 9);

  await dbDeleteItem('db-1');
  const afterDelete = await dbGetAllItems();
  assert.equal(afterDelete.length, 1);
  assert.equal(afterDelete[0].id, 'db-2');
});
