import { CAPTURE_RESOLUTION } from '../types/album';

export interface CropRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Computes exact natural video source coordinates corresponding to the visible
 * capture framing box inside an `object-cover` `<video>` element.
 */
export function computeObjectCoverCropRect(
  srcWidth: number,
  srcHeight: number,
  videoRect: RectLike,
  frameRect: RectLike,
): CropRect {
  if (
    srcWidth <= 0 ||
    srcHeight <= 0 ||
    videoRect.width <= 0 ||
    videoRect.height <= 0 ||
    frameRect.width <= 0 ||
    frameRect.height <= 0
  ) {
    const side = Math.max(1, Math.min(srcWidth || 256, srcHeight || 256));
    return {
      sx: Math.round(((srcWidth || side) - side) / 2),
      sy: Math.round(((srcHeight || side) - side) / 2),
      sw: side,
      sh: side,
    };
  }

  const scale = Math.max(videoRect.width / srcWidth, videoRect.height / srcHeight);
  const visW = srcWidth * scale;
  const visH = srcHeight * scale;
  const offX = (videoRect.width - visW) / 2;
  const offY = (videoRect.height - visH) / 2;

  const relX = frameRect.left - videoRect.left - offX;
  const relY = frameRect.top - videoRect.top - offY;

  const rawSx = relX / scale;
  const rawSy = relY / scale;
  const rawSw = frameRect.width / scale;
  const rawSh = frameRect.height / scale;

  const sx = Math.max(0, Math.min(srcWidth - 1, Math.round(rawSx)));
  const sy = Math.max(0, Math.min(srcHeight - 1, Math.round(rawSy)));
  const sw = Math.max(1, Math.min(srcWidth - sx, Math.round(rawSw)));
  const sh = Math.max(1, Math.min(srcHeight - sy, Math.round(rawSh)));

  return { sx, sy, sw, sh };
}

/**
 * Crops the framing box from a video/image/canvas source at full lossless
 * resolution (`image/png` up to `CAPTURE_RESOLUTION` px) with zero compression loss.
 */
export function captureSquareFrameDataUrl(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  targetSize = CAPTURE_RESOLUTION,
  frameBoxElement?: HTMLElement | null,
): string {
  const srcWidth =
    source instanceof HTMLVideoElement
      ? source.videoWidth || targetSize
      : source instanceof HTMLImageElement
        ? source.naturalWidth || source.width || targetSize
        : source.width;
  const srcHeight =
    source instanceof HTMLVideoElement
      ? source.videoHeight || targetSize
      : source instanceof HTMLImageElement
        ? source.naturalHeight || source.height || targetSize
        : source.height;

  let crop: CropRect;
  if (source instanceof HTMLVideoElement && frameBoxElement) {
    crop = computeObjectCoverCropRect(
      srcWidth,
      srcHeight,
      source.getBoundingClientRect(),
      frameBoxElement.getBoundingClientRect(),
    );
  } else {
    const side = Math.max(1, Math.min(srcWidth, srcHeight));
    crop = {
      sx: Math.round((srcWidth - side) / 2),
      sy: Math.round((srcHeight - side) / 2),
      sw: side,
      sh: side,
    };
  }

  // Preserve full source resolution up to targetSize (zero unneeded upscaling blur)
  const outSize = Math.max(256, Math.min(targetSize, Math.max(crop.sw, crop.sh, targetSize)));
  const canvas = document.createElement('canvas');
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, outSize, outSize);
  ctx.drawImage(
    source,
    crop.sx,
    crop.sy,
    crop.sw,
    crop.sh,
    0,
    0,
    outSize,
    outSize,
  );
  return canvas.toDataURL('image/png');
}
