import React, { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, RotateCw, Square, X } from 'lucide-react';
import type { CapturedDraft } from '../types/album';
import { calculateCaptureProgress } from '../utils/albumStorage';
import {
  drawMediaToCompressedDataUrl,
  extractFramesFromFile,
  renderFallbackCaptureFrame,
} from '../utils/mediaCapture';

const CAPTURE_DURATION_MS = 10000;
const FALLBACK_DURATION_MS = 3000;

interface CaptureScreenProps {
  initialStreamPromise: Promise<MediaStream> | null;
  onCancel: () => void;
  onComplete: (draft: CapturedDraft) => void;
}

export const CaptureScreen: React.FC<CaptureScreenProps> = ({
  initialStreamPromise,
  onCancel,
  onComplete,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraStatus, setCameraStatus] = useState<'loading' | 'ready' | 'blocked'>('loading');
  const [cameraError, setCameraError] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [galleryError, setGalleryError] = useState('');
  const [fallbackAngle, setFallbackAngle] = useState(0);

  const framesRef = useRef<string[]>([]);
  const timerRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const lastSampleRef = useRef<number>(0);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const attachStream = (stream: MediaStream) => {
    stopStream();
    streamRef.current = stream;
    setCameraStatus('ready');
    setCameraError('');
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {
        // Autoplay muted playsInline is allowed; ignore benign play promise interruptions
      });
    }
  };

  useEffect(() => {
    let cancelled = false;

    if (!initialStreamPromise) {
      setCameraStatus('blocked');
      setCameraError('Камера не запущена. Нажмите «Запросить доступ к камере» или выберите фото из галереи.');
      return;
    }

    initialStreamPromise
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        attachStream(stream);
      })
      .catch(() => {
        if (cancelled) return;
        setCameraStatus('blocked');
        setCameraError(
          'Камера заблокирована или недоступна в этом окне. Вы можете запросить доступ снова, загрузить файл из галереи или попробовать демо-сканирование.',
        );
      });

    return () => {
      cancelled = true;
      window.clearInterval(timerRef.current);
      stopStream();
    };
  }, [initialStreamPromise]);

  // Re-attach stream if video element mounts after status becomes ready
  useEffect(() => {
    if (cameraStatus === 'ready' && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [cameraStatus]);

  const handleRequestCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus('blocked');
      setCameraError('Браузер не поддерживает доступ к камере. Используйте загрузку из галереи или демо-сканирование.');
      return;
    }
    setCameraStatus('loading');
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      attachStream(stream);
    } catch {
      setCameraStatus('blocked');
      setCameraError(
        'Доступ к камере отклонён или устройство не найдено. Разрешите камеру в настройках Chrome или выберите фото/видео из галереи.',
      );
    }
  };

  const finishRecording = (mode: 'camera' | 'demo') => {
    window.clearInterval(timerRef.current);
    setIsRecording(false);

    if (mode === 'camera' && videoRef.current && videoRef.current.readyState >= 2) {
      const finalSnap = drawMediaToCompressedDataUrl(videoRef.current, 640, 0.84);
      if (finalSnap) framesRef.current.push(finalSnap);
    }

    const collected =
      framesRef.current.length > 0
        ? framesRef.current
        : [renderFallbackCaptureFrame(0), renderFallbackCaptureFrame(2)];

    stopStream();
    onComplete({
      frames: collected,
      selectedCoverUrl: collected[0],
      source: mode,
      accentHex: '#D96B43',
    });
  };

  const toggleRecording = () => {
    const isCameraReady = cameraStatus === 'ready';
    const duration = isCameraReady ? CAPTURE_DURATION_MS : FALLBACK_DURATION_MS;

    if (isRecording) {
      finishRecording(isCameraReady ? 'camera' : 'demo');
      return;
    }

    framesRef.current = [];
    setProgress(0);
    setElapsedSec(0);
    setIsRecording(true);
    startTimeRef.current = performance.now();
    lastSampleRef.current = -1500;

    // Grab initial frame immediately
    if (isCameraReady && videoRef.current && videoRef.current.readyState >= 2) {
      const snap = drawMediaToCompressedDataUrl(videoRef.current, 640, 0.84);
      if (snap) framesRef.current.push(snap);
    } else {
      framesRef.current.push(renderFallbackCaptureFrame(0));
    }

    timerRef.current = window.setInterval(() => {
      const elapsed = performance.now() - startTimeRef.current;
      const ratio = calculateCaptureProgress(elapsed, duration);
      setProgress(ratio);
      setElapsedSec(Math.min(Math.ceil(duration / 1000), Math.floor(elapsed / 1000)));
      if (!isCameraReady) {
        setFallbackAngle(Math.round(ratio * 360));
      }

      if (elapsed - lastSampleRef.current >= 1600) {
        lastSampleRef.current = elapsed;
        if (isCameraReady && videoRef.current && videoRef.current.readyState >= 2) {
          const snap = drawMediaToCompressedDataUrl(videoRef.current, 640, 0.8);
          if (snap && framesRef.current.length < 6) {
            framesRef.current.push(snap);
          }
        } else {
          const idx = framesRef.current.length;
          if (idx < 5) {
            framesRef.current.push(renderFallbackCaptureFrame(idx));
          }
        }
      }

      if (elapsed >= duration) {
        finishRecording(isCameraReady ? 'camera' : 'demo');
      }
    }, 60);
  };

  const handleGalleryChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGalleryError('');
    setGalleryBusy(true);
    try {
      const frames = await extractFramesFromFile(file);
      stopStream();
      onComplete({
        frames,
        selectedCoverUrl: frames[0],
        source: 'gallery',
        accentHex: '#D96B43',
      });
    } catch (err) {
      setGalleryError(err instanceof Error ? err.message : 'Не удалось обработать файл');
    } finally {
      setGalleryBusy(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);
  const targetSeconds = cameraStatus === 'ready' ? 10 : 3;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#1A1614] text-white">
      {/* Fullscreen video preview when camera is ready */}
      {cameraStatus === 'ready' && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* Fallback interactive studio preview when camera is blocked or loading */}
      {cameraStatus !== 'ready' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#241E1A] px-6 pb-36 pt-24">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#2E2722] p-6 text-center shadow-xl">
            <div
              role="img"
              aria-label="Интерактивный 3D-макет для вращения пальцем"
              onPointerDown={(e) => {
                (e.currentTarget as HTMLElement).dataset.dragX = String(e.clientX);
              }}
              onPointerMove={(e) => {
                const startX = (e.currentTarget as HTMLElement).dataset.dragX;
                if (!startX) return;
                const delta = e.clientX - Number(startX);
                (e.currentTarget as HTMLElement).dataset.dragX = String(e.clientX);
                setFallbackAngle((prev) => prev + delta * 0.9);
              }}
              onPointerUp={(e) => {
                delete (e.currentTarget as HTMLElement).dataset.dragX;
              }}
              onPointerCancel={(e) => {
                delete (e.currentTarget as HTMLElement).dataset.dragX;
              }}
              className="mx-auto flex h-24 w-24 cursor-grab touch-none select-none items-center justify-center rounded-2xl bg-[#3D342E] transition-transform duration-75 active:cursor-grabbing"
              style={{ transform: `rotateY(${fallbackAngle}deg) rotateZ(${Math.round(fallbackAngle * 0.15)}deg)` }}
            >
              <svg viewBox="0 0 80 80" className="h-16 w-16" aria-hidden="true">
                <polygon points="40,8 68,24 40,40 12,24" fill="#E98A66" />
                <polygon points="12,24 40,40 40,72 12,56" fill="#D96B43" />
                <polygon points="68,24 68,56 40,72 40,40" fill="#B54F2B" />
              </svg>
            </div>
            <p className="mt-2 text-[11px] text-[#ABA097]">
              Потяните макет пальцем для осмотра
            </p>

            <h2 className="mt-2 text-base font-semibold text-white">
              {cameraStatus === 'loading'
                ? 'Подключение камеры...'
                : 'Режим без камеры (Fallback)'}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-[#CFC6BE]">
              {cameraError || 'Ожидаем разрешение браузера на использование основной камеры.'}
            </p>

            <button
              type="button"
              onClick={handleRequestCamera}
              className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-[#231E1A] transition-colors hover:bg-[#FAF8F5]"
            >
              <Camera className="h-4 w-4 text-[#D96B43]" aria-hidden="true" />
              <span>Запросить доступ к камере</span>
            </button>

            <p className="mt-3 text-[11px] text-[#ABA097]">
              Или нажмите красную кнопку ниже для демо-съёмки, либо загрузите фото с телефона.
            </p>
          </div>
        </div>
      )}

      {/* Top instruction bar */}
      <div className="relative z-10 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 via-black/35 to-transparent px-4 pt-5 pb-8">
        <div className="rounded-2xl bg-black/45 px-4 py-2.5 text-sm font-medium leading-snug text-white">
          Медленно обойдите вещь по кругу (10–15 сек)
        </div>
        <button
          type="button"
          onClick={() => {
            window.clearInterval(timerRef.current);
            stopStream();
            onCancel();
          }}
          aria-label="Закрыть камеру"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black/50 text-white transition-colors hover:bg-black/70"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Bottom controls bar */}
      <div className="relative z-10 mt-auto bg-gradient-to-t from-black/85 via-black/55 to-transparent px-5 pt-8 pb-7">
        {galleryError && (
          <p className="mb-3 rounded-xl bg-[#B84A32] px-3 py-2 text-center text-xs font-medium text-white">
            {galleryError}
          </p>
        )}

        <div className="mx-auto flex max-w-md items-center justify-between gap-4">
          {/* Gallery input button */}
          <button
            type="button"
            disabled={galleryBusy || isRecording}
            onClick={() => fileInputRef.current?.click()}
            className="flex min-h-[48px] min-w-[112px] items-center justify-center gap-2 rounded-2xl bg-white/15 px-3.5 py-2.5 text-xs font-medium text-white transition-colors hover:bg-white/25 disabled:opacity-50"
          >
            <ImagePlus className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{galleryBusy ? 'Чтение...' : 'Из галереи'}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*"
            onChange={handleGalleryChange}
            className="hidden"
            aria-label="Выбрать фото или видео из галереи"
          />

          {/* Circular 10s progress + start/stop button */}
          <div className="flex flex-col items-center">
            <div className="relative flex h-20 w-20 items-center justify-center">
              <svg
                className="pointer-events-none absolute inset-0 h-20 w-20 -rotate-90"
                viewBox="0 0 80 80"
                aria-hidden="true"
              >
                <circle
                  cx="40"
                  cy="40"
                  r={radius}
                  fill="none"
                  stroke="rgba(255,255,255,0.28)"
                  strokeWidth="4.5"
                />
                <circle
                  cx="40"
                  cy="40"
                  r={radius}
                  fill="none"
                  stroke="#D96B43"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                />
              </svg>

              <button
                type="button"
                onClick={toggleRecording}
                data-testid="capture-record-btn"
                aria-label={
                  isRecording
                    ? 'Остановить съёмку'
                    : cameraStatus === 'ready'
                      ? 'Начать съёмку'
                      : 'Запустить демо-съёмку'
                }
                className="flex h-14 w-14 items-center justify-center rounded-full bg-[#D96B43] text-white shadow-lg transition-transform active:scale-95"
              >
                {isRecording ? (
                  <Square className="h-5 w-5 fill-current" aria-hidden="true" />
                ) : (
                  <span className="h-5 w-5 rounded-full bg-white" />
                )}
              </button>
            </div>
            <span className="mt-1.5 text-xs font-medium text-[#E5DDD5] tabular-nums">
              {isRecording
                ? `${elapsedSec} / ${targetSeconds} сек`
                : cameraStatus === 'ready'
                  ? 'Старт (10 сек)'
                  : 'Демо-скан'}
            </span>
          </div>

          {/* Quick instant photo snap / retry camera */}
          <button
            type="button"
            disabled={isRecording}
            onClick={cameraStatus === 'ready' ? toggleRecording : handleRequestCamera}
            className="flex min-h-[48px] min-w-[112px] items-center justify-center gap-2 rounded-2xl bg-white/15 px-3.5 py-2.5 text-xs font-medium text-white transition-colors hover:bg-white/25 disabled:opacity-50"
          >
            <RotateCw className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{cameraStatus === 'ready' ? '360° скан' : 'Повторить'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
