import test from 'node:test';
import assert from 'node:assert/strict';
import { computeAlphaCutoutMask, rgbToLab } from './backgroundRemoval';

function makeRgbaBuffer(
  width: number,
  height: number,
  pixelFn: (x: number, y: number) => [number, number, number, number],
): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y);
      const idx = (y * width + x) * 4;
      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
      buf[idx + 3] = a;
    }
  }
  return buf;
}

test('rgbToLab maps neutral white and saturated terracotta sensibly', () => {
  const [Lwhite, aWhite, bWhite] = rgbToLab(255, 255, 255);
  assert.ok(Lwhite > 99 && Lwhite <= 100.5);
  assert.ok(Math.abs(aWhite) < 1 && Math.abs(bWhite) < 1);

  const [Lterra, aTerra, bTerra] = rgbToLab(217, 107, 67);
  assert.ok(Lterra > 45 && Lterra < 70);
  assert.ok(aTerra > 30);
  assert.ok(bTerra > 25);
});

test('computeAlphaCutoutMask strips outer table background, preserves central object + enclosed interior logo, and drops outer speckles', () => {
  const w = 64;
  const h = 64;
  const rgba = makeRgbaBuffer(w, h, (x, y) => {
    const dx = x - 32;
    const dy = y - 32;
    const dist = Math.hypot(dx, dy);

    // Central bright ceramic object (radius 18) with an enclosed dark emblem (radius 5) matching the dark backdrop
    if (dist <= 5) {
      return [38, 34, 32, 255];
    }
    if (dist <= 18) {
      return [242, 236, 228, 255];
    }
    // Stray white dust speck in top-left corner outside perimeter margin
    if (x >= 7 && x <= 10 && y >= 7 && y <= 10) {
      return [245, 240, 235, 255];
    }
    // Dark wooden tabletop background
    return [38, 34, 32, 255];
  });

  const mask = computeAlphaCutoutMask(rgba, w, h, 28);

  // Outer corners must become fully transparent
  assert.equal(mask[0], 0);
  assert.equal(mask[w - 1], 0);
  assert.equal(mask[(h - 1) * w], 0);
  assert.equal(mask[h * w - 1], 0);

  // Central ceramic object must remain opaque (>= 170, interior = 255)
  assert.equal(mask[32 * w + 42], 255);
  // Enclosed dark interior emblem must NOT be punched with a hole
  assert.equal(mask[32 * w + 32], 255);

  // Stray corner speckle must be discarded (only largest central component kept)
  assert.equal(mask[8 * w + 8], 0);
});

test('computeAlphaCutoutMask preserves pre-transparent studio PNG cutouts untouched', () => {
  const w = 32;
  const h = 32;
  const rgba = makeRgbaBuffer(w, h, (x, y) => {
    const dist = Math.hypot(x - 16, y - 16);
    if (dist < 8) return [217, 107, 67, 255];
    if (dist < 10) return [217, 107, 67, 128];
    return [0, 0, 0, 0];
  });

  const mask = computeAlphaCutoutMask(rgba, w, h, 28);
  assert.equal(mask[0], 0);
  assert.equal(mask[16 * w + 16], 255);
  // Soft anti-aliased edge at distance 9 preserved verbatim
  assert.equal(mask[16 * w + 25], 128);
});
