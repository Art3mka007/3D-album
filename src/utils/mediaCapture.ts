/**
 * Compresses an HTMLImageElement, HTMLVideoElement, or HTMLCanvasElement
 * into a lightweight JPEG data URL suitable for localStorage persistence
 * and crisp Three.js CanvasTexture mapping.
 */
export function drawMediaToCompressedDataUrl(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  maxDimension = 640,
  quality = 0.82,
): string {
  const srcWidth =
    source instanceof HTMLVideoElement
      ? source.videoWidth || 640
      : source instanceof HTMLImageElement
        ? source.naturalWidth || source.width || 640
        : source.width;
  const srcHeight =
    source instanceof HTMLVideoElement
      ? source.videoHeight || 480
      : source instanceof HTMLImageElement
        ? source.naturalHeight || source.height || 480
        : source.height;

  const scale = Math.min(1, maxDimension / Math.max(srcWidth, srcHeight, 1));
  const targetW = Math.max(1, Math.round(srcWidth * scale));
  const targetH = Math.max(1, Math.round(srcHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#FAF8F5';
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(source, 0, 0, targetW, targetH);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Generates a warm editorial procedural studio snapshot on an offscreen 2D canvas
 * when the user uses the interactive 3D fallback capture without a physical camera.
 */
export function renderFallbackCaptureFrame(stepIndex = 0): string {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Warm beige studio gradient
  const grad = ctx.createLinearGradient(0, 0, 640, 480);
  grad.addColorStop(0, '#F5EFE7');
  grad.addColorStop(1, '#E8DDD0');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 640, 480);

  // Pedestal ellipse shadow
  ctx.fillStyle = 'rgba(35, 30, 26, 0.12)';
  ctx.beginPath();
  ctx.ellipse(320, 355, 130, 32, 0, 0, Math.PI * 2);
  ctx.fill();

  // Warm terracotta ceramic vessel silhouette rotated slightly per frame
  const tilt = ((stepIndex % 6) - 2.5) * 0.06;
  ctx.save();
  ctx.translate(320, 240);
  ctx.rotate(tilt);

  const bodyGrad = ctx.createLinearGradient(-70, -90, 70, 90);
  bodyGrad.addColorStop(0, '#E8835C');
  bodyGrad.addColorStop(0.6, '#D96B43');
  bodyGrad.addColorStop(1, '#A94B2A');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(-42, -88);
  ctx.bezierCurveTo(-82, -30, -86, 60, -50, 96);
  ctx.lineTo(50, 96);
  ctx.bezierCurveTo(86, 60, 82, -30, 42, -88);
  ctx.closePath();
  ctx.fill();

  // Rim highlight
  ctx.fillStyle = '#F2ECE4';
  ctx.beginPath();
  ctx.ellipse(0, -88, 42, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#3B302A';
  ctx.beginPath();
  ctx.ellipse(0, -88, 30, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  return canvas.toDataURL('image/jpeg', 0.85);
}

/**
 * Loads an image or video File from <input type="file"> and extracts compressed JPEG frame(s).
 */
export async function extractFramesFromFile(file: File): Promise<string[]> {
  if (file.type.startsWith('image/')) {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Не удалось загрузить изображение'));
        image.src = objectUrl;
      });
      const dataUrl = drawMediaToCompressedDataUrl(img, 640, 0.82);
      return dataUrl ? [dataUrl] : [];
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  if (file.type.startsWith('video/')) {
    const objectUrl = URL.createObjectURL(file);
    try {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.src = objectUrl;

      await new Promise<void>((resolve, reject) => {
        const onLoaded = () => resolve();
        const onError = () => reject(new Error('Не удалось прочитать видео'));
        video.addEventListener('loadeddata', onLoaded, { once: true });
        video.addEventListener('error', onError, { once: true });
      });

      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
      const sampleRatios = [0.15, 0.5, 0.82];
      const frames: string[] = [];

      for (const ratio of sampleRatios) {
        video.currentTime = Math.min(duration - 0.05, Math.max(0, duration * ratio));
        await new Promise<void>((resolve) => {
          video.addEventListener('seeked', () => resolve(), { once: true });
          window.setTimeout(resolve, 400);
        });
        const frame = drawMediaToCompressedDataUrl(video, 640, 0.8);
        if (frame) frames.push(frame);
      }

      return frames.length > 0 ? frames : [renderFallbackCaptureFrame(0)];
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  throw new Error('Поддерживаются только фото и видео файлы');
}
