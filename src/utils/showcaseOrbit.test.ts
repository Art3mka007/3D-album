import test from 'node:test';
import assert from 'node:assert/strict';
import { computeObjectCoverCropRect } from './mediaCapture';
import {
  computeCrossfadeLayers,
  projectGhostPoint,
  resolvePresetTarget,
  shortestOrbitDelta,
  stepOrbitInertia,
  wrapOrbitIndex,
} from './showcaseOrbit';

test('computeCrossfadeLayers wraps seamlessly across 315° -> 0° and interpolates opacity', () => {
  const exact = computeCrossfadeLayers(0);
  assert.equal(exact.primaryIndex, 0);
  assert.equal(exact.primaryOpacity, 1);
  assert.equal(exact.secondaryOpacity, 0);
  assert.equal(exact.activeDeg, 0);

  // Halfway between 315° (index 7) and 0° (index 0)
  const seam = computeCrossfadeLayers(-0.5);
  assert.equal(seam.primaryIndex, 7);
  assert.equal(seam.secondaryIndex, 0);
  assert.ok(Math.abs(seam.primaryOpacity - 0.5) < 1e-6);
  assert.ok(Math.abs(seam.secondaryOpacity - 0.5) < 1e-6);
});

test('shortestOrbitDelta picks minimal circular path modulo 8', () => {
  assert.ok(Math.abs(shortestOrbitDelta(7, 0) - 1) < 1e-6);
  assert.ok(Math.abs(shortestOrbitDelta(1, 7) - -2) < 1e-6);
  assert.equal(wrapOrbitIndex(-1), 7);
  assert.equal(wrapOrbitIndex(8.25), 0.25);
});

test('stepOrbitInertia coasts smoothly and settles to nearest 45° frame', () => {
  let state = { orbitPos: 1.2, velocity: 4.5, settled: false };
  for (let i = 0; i < 160; i++) {
    state = stepOrbitInertia(state, 1 / 60);
    if (state.settled) break;
  }
  assert.equal(state.settled, true);
  assert.equal(state.velocity, 0);
  assert.equal(Math.round(state.orbitPos) - state.orbitPos, 0);
});

test('resolvePresetTarget handles quick angles and toggles Top view cleanly on second click', () => {
  const toTop = resolvePresetTarget(false, 'top', 2.4);
  assert.equal(toTop.topActive, true);

  const backToOrbit = resolvePresetTarget(true, 'top', 2.4);
  assert.equal(backToOrbit.topActive, false);
  assert.equal(backToOrbit.targetOrbitPos, 2);

  const toRight = resolvePresetTarget(true, 'right', 0);
  assert.equal(toRight.topActive, false);
  assert.equal(wrapOrbitIndex(toRight.targetOrbitPos), 2);
});

test('projectGhostPoint centers origin and computeObjectCoverCropRect crops square center', () => {
  const [u, v] = projectGhostPoint(0, 0, 0, 1, 0, 1, 0, 200, 200);
  assert.ok(Math.abs(u - 99.5) < 1e-6);
  assert.ok(Math.abs(v - 99.5) < 1e-6);

  const crop = computeObjectCoverCropRect(
    1920,
    1080,
    { left: 0, top: 0, width: 390, height: 844 },
    { left: 67, top: 294, width: 256, height: 256 },
  );
  assert.equal(crop.sw, crop.sh);
  assert.ok(Math.abs(crop.sx + crop.sw / 2 - 960) <= 2);
});
