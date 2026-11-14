// Fast sRGB -> linear LUT for CIE L*a*b* conversion
const SRGB_TO_LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB_TO_LINEAR[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function labF(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

/**
 * Converts 8-bit sRGB [0..255] to CIE L*a*b* (D65).
 */
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lr = SRGB_TO_LINEAR[r & 255];
  const lg = SRGB_TO_LINEAR[g & 255];
  const lb = SRGB_TO_LINEAR[b & 255];

  const x = (lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) / 0.95047;
  const y = (lr * 0.2126729 + lg * 0.7151522 + lb * 0.072175) / 1.0;
  const z = (lr * 0.0193339 + lg * 0.119192 + lb * 0.9503041) / 1.08883;

  const fx = labF(x);
  const fy = labF(y);
  const fz = labF(z);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function medianOfArray(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Computes a soft transparent-alpha cutout mask (`0..255` per pixel) for an RGBA buffer:
 * 1. Samples outer 6% border ring in CIE L*a*b* to estimate background tone & variance.
 * 2. Performs border-seeded flood fill so interior object highlights/prints matching the
 *    background color are NEVER punched with holes.
 * 3. Protects the central foreground subject and feathers boundary alpha (1.5 px smooth transition)
 *    so the cutout stands cleanly on a graphical 2.5D podium without jagged halos.
 *
 * @param rgba Image pixel buffer (length = width * height * 4)
 * @param width Width in pixels
 * @param height Height in pixels
 * @param sensitivity Background sensitivity 10..70 (default 28; higher strips more shadows/edges)
 */
export function computeAlphaCutoutMask(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  sensitivity = 28,
): Uint8Array {
  const total = width * height;
  const alphaOut = new Uint8Array(total);
  if (total === 0) return alphaOut;

  // Check if image already carries genuine transparency around its corners (e.g. studio PNG cutout)
  const cornerCoords = [
    0,
    width - 1,
    (height - 1) * width,
    height * width - 1,
  ];
  let transparentCorners = 0;
  for (const c of cornerCoords) {
    if (rgba[c * 4 + 3] < 24) transparentCorners++;
  }
  if (transparentCorners >= 3) {
    for (let i = 0; i < total; i++) {
      alphaOut[i] = rgba[i * 4 + 3];
    }
    return alphaOut;
  }

  const LArr = new Float32Array(total);
  const aArr = new Float32Array(total);
  const bArr = new Float32Array(total);

  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    const [L, a, bLab] = rgbToLab(rgba[idx], rgba[idx + 1], rgba[idx + 2]);
    LArr[i] = L;
    aArr[i] = a;
    bArr[i] = bLab;
  }

  // 1. Sample 6% outer perimeter ring for median LAB background estimation
  const margin = Math.max(2, Math.round(Math.min(width, height) * 0.06));
  const perimL: number[] = [];
  const perimA: number[] = [];
  const perimB: number[] = [];
  const stride = total > 8192 ? 2 : 1;

  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      if (y < margin || y >= height - margin || x < margin || x >= width - margin) {
        const p = y * width + x;
        perimL.push(LArr[p]);
        perimA.push(aArr[p]);
        perimB.push(bArr[p]);
      }
    }
  }

  const bgL = medianOfArray(perimL);
  const bgA = medianOfArray(perimA);
  const bgB = medianOfArray(perimB);

  let spreadSum = 0;
  for (let i = 0; i < perimL.length; i++) {
    const dL = perimL[i] - bgL;
    const da = perimA[i] - bgA;
    const db = perimB[i] - bgB;
    spreadSum += Math.sqrt(0.45 * dL * dL + 1.25 * (da * da + db * db));
  }
  const bgSpread = spreadSum / Math.max(1, perimL.length);

  // Compute chroma-weighted perceptual LAB distance from perimeter background for every pixel
  const clampedSens = Math.max(10, Math.min(70, sensitivity));
  const hardThresh = 9 + clampedSens * 0.32 + Math.min(8, bgSpread * 0.75);
  const softOuterThresh = hardThresh * 1.45;
  const distField = new Float32Array(total);

  for (let i = 0; i < total; i++) {
    const dL = LArr[i] - bgL;
    const da = aArr[i] - bgA;
    const db = bArr[i] - bgB;
    const chromaSq = da * da + db * db;
    // Neutral table shadows (darker than table with low chroma shift) use lower L weight
    const lWeight = dL < 0 && chromaSq < 49 ? 0.25 : 0.7;
    distField[i] = Math.sqrt(lWeight * dL * dL + 1.35 * chromaSq);
  }

  // 2. Border-seeded BFS flood fill so exterior table/wall is stripped without touching interior details
  const isBg = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const trySeed = (p: number) => {
    if (!isBg[p] && distField[p] <= softOuterThresh) {
      isBg[p] = 1;
      queue[tail++] = p;
    }
  };

  for (let x = 0; x < width; x++) {
    trySeed(x);
    trySeed((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    trySeed(y * width);
    trySeed(y * width + (width - 1));
  }

  while (head < tail) {
    const p = queue[head++];
    const x = p % width;
    const y = (p - x) / width;

    if (x > 0 && !isBg[p - 1] && distField[p - 1] <= hardThresh) {
      isBg[p - 1] = 1;
      queue[tail++] = p - 1;
    }
    if (x + 1 < width && !isBg[p + 1] && distField[p + 1] <= hardThresh) {
      isBg[p + 1] = 1;
      queue[tail++] = p + 1;
    }
    if (y > 0 && !isBg[p - width] && distField[p - width] <= hardThresh) {
      isBg[p - width] = 1;
      queue[tail++] = p - width;
    }
    if (y + 1 < height && !isBg[p + width] && distField[p + width] <= hardThresh) {
      isBg[p + width] = 1;
      queue[tail++] = p + width;
    }
  }

  // Fallback safeguard: if background matched > 97% of pixels, keep full frame intact
  let bgCount = 0;
  for (let i = 0; i < total; i++) {
    if (isBg[i]) bgCount++;
  }
  if (bgCount >= total * 0.97) {
    alphaOut.fill(255);
    return alphaOut;
  }

  // 3. Retain largest central foreground component so isolated stray corner specks are dropped
  const visited = new Uint8Array(total);
  const compBuf = new Int32Array(total);
  let bestScore = -1;
  let bestPixels: number[] = [];
  const cxFrame = width * 0.5;
  const cyFrame = height * 0.5;
  const maxDistSq = Math.max(1, cxFrame * cxFrame + cyFrame * cyFrame);

  for (let i = 0; i < total; i++) {
    if (isBg[i] || visited[i]) continue;
    let cHead = 0;
    let cTail = 0;
    let len = 0;
    let sumX = 0;
    let sumY = 0;

    visited[i] = 1;
    queue[cTail++] = i;

    while (cHead < cTail) {
      const p = queue[cHead++];
      compBuf[len++] = p;
      const x = p % width;
      const y = (p - x) / width;
      sumX += x;
      sumY += y;

      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const np = ny * width + nx;
          if (!isBg[np] && !visited[np]) {
            visited[np] = 1;
            queue[cTail++] = np;
          }
        }
      }
    }

    if (len < 16) continue;
    const meanX = sumX / len;
    const meanY = sumY / len;
    const dCenterSq = (meanX - cxFrame) ** 2 + (meanY - cyFrame) ** 2;
    const score = len / (1 + 2.0 * (dCenterSq / maxDistSq));
    if (score > bestScore) {
      bestScore = score;
      bestPixels = Array.from(compBuf.subarray(0, len));
    }
  }

  if (bestPixels.length === 0) {
    alphaOut.fill(255);
    return alphaOut;
  }

  const fgBinary = new Uint8Array(total);
  for (let i = 0; i < bestPixels.length; i++) {
    fgBinary[bestPixels[i]] = 1;
  }

  // 4. Anti-aliased soft alpha feathering on the immediate 1-pixel rim
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (fgBinary[p]) {
        // Check 4-neighbors; if bordering background and LAB distance is near threshold, soften slightly
        let bgNeighbors = 0;
        if (x > 0 && !fgBinary[p - 1]) bgNeighbors++;
        if (x + 1 < width && !fgBinary[p + 1]) bgNeighbors++;
        if (y > 0 && !fgBinary[p - width]) bgNeighbors++;
        if (y + 1 < height && !fgBinary[p + width]) bgNeighbors++;

        if (bgNeighbors > 0 && distField[p] < softOuterThresh) {
          const t = Math.max(0, Math.min(1, (distField[p] - hardThresh * 0.7) / (softOuterThresh - hardThresh * 0.7)));
          alphaOut[p] = Math.round(170 + t * 85);
        } else {
          alphaOut[p] = 255;
        }
      } else {
        // Soft outer anti-alias halo if immediately adjacent to foreground and somewhat distinct from background
        let fgNeighbors = 0;
        if (x > 0 && fgBinary[p - 1]) fgNeighbors++;
        if (x + 1 < width && fgBinary[p + 1]) fgNeighbors++;
        if (y > 0 && fgBinary[p - width]) fgNeighbors++;
        if (y + 1 < height && fgBinary[p + width]) fgNeighbors++;

        if (fgNeighbors >= 2 && distField[p] > hardThresh * 0.65) {
          const t = Math.max(0, Math.min(1, distField[p] / hardThresh));
          alphaOut[p] = Math.round(t * 110);
        } else {
          alphaOut[p] = 0;
        }
      }
    }
  }

  return alphaOut;
}

/**
 * Automatically strips the background from a high-resolution captured image DataURL
 * using a fast analysis pass (~320px) and composites the soft alpha mask onto the
 * full-resolution original lossless PNG without reducing image sharpness.
 */
export async function removeBackgroundToTransparentPng(
  sourceDataUrl: string,
  sensitivity = 28,
): Promise<string> {
  if (typeof document === 'undefined') return sourceDataUrl;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Не удалось декодировать изображение для удаления фона'));
    el.src = sourceDataUrl;
  });

  const fullW = img.naturalWidth || img.width;
  const fullH = img.naturalHeight || img.height;
  if (fullW <= 0 || fullH <= 0) return sourceDataUrl;

  // Quick check: if corners on a tiny probe already have transparent alpha, keep original lossless PNG untouched
  const workSize = Math.min(320, Math.max(fullW, fullH));
  const workW = Math.max(32, Math.round((fullW / Math.max(fullW, fullH)) * workSize));
  const workH = Math.max(32, Math.round((fullH / Math.max(fullW, fullH)) * workSize));

  const workCanvas = document.createElement('canvas');
  workCanvas.width = workW;
  workCanvas.height = workH;
  const workCtx = workCanvas.getContext('2d', { willReadFrequently: true });
  if (!workCtx) return sourceDataUrl;
  workCtx.drawImage(img, 0, 0, workW, workH);
  const workData = workCtx.getImageData(0, 0, workW, workH);

  // If source already has transparent corners (alpha < 24), return unmodified lossless DataURL
  const c0 = workData.data[3];
  const c1 = workData.data[(workW - 1) * 4 + 3];
  const c2 = workData.data[(workH - 1) * workW * 4 + 3];
  const c3 = workData.data[(workH * workW - 1) * 4 + 3];
  if ((c0 < 24 ? 1 : 0) + (c1 < 24 ? 1 : 0) + (c2 < 24 ? 1 : 0) + (c3 < 24 ? 1 : 0) >= 3) {
    return sourceDataUrl;
  }

  const alphaMask = computeAlphaCutoutMask(workData.data, workW, workH, sensitivity);

  // Build smoothed alpha mask canvas at analysis resolution, then composite via destination-in onto full-res RGB
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = workW;
  maskCanvas.height = workH;
  const maskCtx = maskCanvas.getContext('2d');
  if (!maskCtx) return sourceDataUrl;

  const maskImg = maskCtx.createImageData(workW, workH);
  for (let i = 0; i < workW * workH; i++) {
    const idx = i * 4;
    maskImg.data[idx] = 255;
    maskImg.data[idx + 1] = 255;
    maskImg.data[idx + 2] = 255;
    maskImg.data[idx + 3] = alphaMask[i];
  }
  maskCtx.putImageData(maskImg, 0, 0);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = fullW;
  outCanvas.height = fullH;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) return sourceDataUrl;

  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';
  outCtx.drawImage(img, 0, 0, fullW, fullH);
  outCtx.globalCompositeOperation = 'destination-in';
  outCtx.drawImage(maskCanvas, 0, 0, fullW, fullH);
  outCtx.globalCompositeOperation = 'source-over';

  return outCanvas.toDataURL('image/png');
}
