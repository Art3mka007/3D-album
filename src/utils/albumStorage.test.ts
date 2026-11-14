import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPTURE_STEPS, type CapturedViewFrame } from '../types/album';
import {
  createAlbumItem,
  deleteAlbumItem,
  filterAlbumItems,
  formatRussianCount,
  formatRussianDate,
  getCaptureStepMeta,
} from './albumStorage';

function makeDummyViews(prefix = 'frame'): CapturedViewFrame[] {
  return CAPTURE_STEPS.map((step) => ({
    stepIndex: step.index,
    shortLabel: step.shortLabel,
    yawDeg: step.yawDeg,
    tiltDeg: step.tiltDeg,
    dataUrl: `data:image/jpeg;base64,${prefix}-${step.index}`,
  }));
}

test('filterAlbumItems matches Russian titles and notes case-insensitively', () => {
  const items = [
    createAlbumItem({
      id: '1',
      title: 'Старый Зенит',
      note: 'Плёночный фотоаппарат',
      views: makeDummyViews('a'),
      source: 'demo',
    }),
    createAlbumItem({
      id: '2',
      title: 'Керамическая ваза',
      note: 'Привезена из Крыма',
      views: makeDummyViews('b'),
      source: 'camera',
    }),
  ];

  assert.equal(filterAlbumItems(items, 'зенит').length, 1);
  assert.equal(filterAlbumItems(items, 'крым').length, 1);
  assert.equal(filterAlbumItems(items, '  ').length, 2);
});

test('CAPTURE_STEPS has 9 views: 8 circular 45° steps + 1 top-down view', () => {
  assert.equal(CAPTURE_STEPS.length, 9);
  const circularYaws = CAPTURE_STEPS.slice(0, 8).map((s) => s.yawDeg);
  assert.deepEqual(circularYaws, [0, 45, 90, 135, 180, 225, 270, 315]);
  assert.equal(getCaptureStepMeta(0).instruction, 'Поставьте предмет лицевой стороной (0°)');
  assert.equal(getCaptureStepMeta(8).tiltDeg, 90);
  assert.equal(getCaptureStepMeta(8).shortLabel, 'Сверху');
});

test('createAlbumItem enforces title, sets 0° front frame as coverUrl, and deleteAlbumItem removes item', () => {
  assert.throws(() =>
    createAlbumItem({
      title: '   ',
      note: '',
      views: makeDummyViews(),
      source: 'camera',
    }),
  );

  const views = makeDummyViews('mug');
  const item = createAlbumItem({
    id: 'x1',
    title: '  Чашка  ',
    note: 'Утренняя',
    views,
    source: 'camera',
  });
  assert.equal(item.title, 'Чашка');
  assert.equal(item.coverUrl, views[0].dataUrl);
  assert.equal(item.views.length, 9);
  assert.equal(deleteAlbumItem([item], 'x1').length, 0);
});

test('Russian date and count formatting work accurately', () => {
  assert.equal(formatRussianDate('2026-10-14T11:30:00.000Z'), '14 окт 2026');
  assert.equal(formatRussianCount(1), '1 вещь');
  assert.equal(formatRussianCount(3), '3 вещи');
  assert.equal(formatRussianCount(11), '11 вещей');
});
