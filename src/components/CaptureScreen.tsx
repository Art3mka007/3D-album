import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  X,
} from 'lucide-react';
import {
  CAPTURE_RESOLUTION,
  CAPTURE_STEPS,
  DEMO_RESOLUTION,
  type CapturedDraft,
  type CapturedViewFrame,
} from '../types/album';
import { generateAllFallbackSteps, renderFallbackStepFrame } from '../utils/demoStudio';
import { captureSquareFrameDataUrl } from '../utils/mediaCapture';
import { projectGhostPoint } from '../utils/showcaseOrbit';

interface CaptureScreenProps {
  initialStreamPromise: Promise<MediaStream> | null;
  onCancel: () => void;
  onComplete: (draft: CapturedDraft) => void;
}

/**
 * Projects a semi-transparent wireframe ghost box with a highlighted
 * terracotta front face matching the camera yaw & tilt of the current step.
 */
function buildWireframeGuideSvg(yawDeg: number, tiltDeg: number) {
  const size = 200;
  const yawRad = (yawDeg * Math.PI) / 180;
  const tiltRad = (tiltDeg * Math.PI) / 180;
  const cosY = Math.cos(yawRad);
  const sinY = Math.sin(yawRad);
  const cosT = Math.cos(tiltRad);
  const sinT = Math.sin(tiltRad);

  const hx = 0.42;
  const hy = 0.46;
  const hz = 0.34;
  const corners: Array<[number, number, number]> = [
    [-hx, -hy, hz],
    [hx, -hy, hz],
    [hx, hy, hz],
    [-hx, hy, hz],
    [-hx, -hy, -hz],
    [hx, -hy, -hz],
    [hx, hy, -hz],
    [-hx, hy, -hz],
  ];

  const projected = corners.map(([x, y, z]) => {
    const [u, v] = projectGhostPoint(x, y, z, cosY, sinY, cosT, sinT, size, size);
    return [Math.round(u * 10) / 10, Math.round(v * 10) / 10] as [number, number];
  });

  const [ax0, ay0] = projectGhostPoint(0, 0, 0, cosY, sinY, cosT, sinT, size, size);
  const [ax1, ay1] = projectGhostPoint(0, 0, 0.72, cosY, sinY, cosT, sinT, size, size);

  const edges: Array<[number, number]> = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];

  const frontPoly = `${projected[0][0]},${projected[0][1]} ${projected[1][0]},${projected[1][1]} ${projected[2][0]},${projected[2][1]} ${projected[3][0]},${projected[3][1]}`;

  return {
    projected,
    edges,
    frontPoly,
    arrowStart: [ax0, ay0] as [number, number],
    arrowEnd: [ax1, ay1] as [number, number],
  };
}

export const CaptureScreen: React.FC<CaptureScreenProps> = ({
  initialStreamPromise,
  onCancel,
  onComplete,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameBoxRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraStatus, setCameraStatus] = useState<'loading' | 'ready' | 'blocked'>('loading');
  const [cameraError, setCameraError] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [capturedFrames, setCapturedFrames] = useState<CapturedViewFrame[]>([]);
  const [showOnionSkin, setShowOnionSkin] = useState(true);
  const [measuredTiltDeg, setMeasuredTiltDeg] = useState<number | null>(null);
  const [fallbackPreviewUrl, setFallbackPreviewUrl] = useState('');

  const currentStep = CAPTURE_STEPS[stepIndex] ?? CAPTURE_STEPS[0];

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
      videoRef.current.play().catch(() => {});
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!initialStreamPromise) {
      setCameraStatus('blocked');
      setCameraError(
        'Камера не запущена. Разрешите доступ к камере или протестируйте пошаговый демо-набор.',
      );
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
          'Камера недоступна в окне предпросмотра. Нажмите «Запросить камеру» или используйте демо-съёмку.',
        );
      });

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [initialStreamPromise]);

  useEffect(() => {
    if (cameraStatus === 'ready' && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [cameraStatus]);

  useEffect(() => {
    if (cameraStatus === 'ready') return;
    setFallbackPreviewUrl(renderFallbackStepFrame(stepIndex, DEMO_RESOLUTION));
  }, [stepIndex, cameraStatus]);

  // Horizon / camera tilt level indicator for consistent framing across all 9 shots
  useEffect(() => {
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta == null) return;
      const pitchDown = Math.max(0, Math.min(90, Math.round(90 - Math.abs(e.beta))));
      setMeasuredTiltDeg(pitchDown);
    };
    window.addEventListener('deviceorientation', onOrientation);
    return () => window.removeEventListener('deviceorientation', onOrientation);
  }, []);

  const handleRequestCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus('blocked');
      setCameraError('Браузер не поддерживает камеру. Доступен режим демо-съёмки.');
      return;
    }
    setCameraStatus('loading');
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      attachStream(stream);
    } catch {
      setCameraStatus('blocked');
      setCameraError(
        'Доступ к камере отклонён. Разрешите камеру в настройках браузера или используйте демо-съёмку.',
      );
    }
  };

  const wireframeGuide = useMemo(
    () => buildWireframeGuideSvg(currentStep.yawDeg, currentStep.tiltDeg),
    [currentStep.yawDeg, currentStep.tiltDeg],
  );

  const handleCaptureStep = () => {
    const isLive =
      cameraStatus === 'ready' &&
      videoRef.current &&
      videoRef.current.readyState >= 2;

    const frameDataUrl = isLive && videoRef.current
      ? captureSquareFrameDataUrl(
          videoRef.current,
          CAPTURE_RESOLUTION,
          frameBoxRef.current,
        )
      : renderFallbackStepFrame(stepIndex, DEMO_RESOLUTION);

    const nextFrame: CapturedViewFrame = {
      stepIndex: currentStep.index,
      shortLabel: currentStep.shortLabel,
      yawDeg: currentStep.yawDeg,
      tiltDeg: currentStep.tiltDeg,
      dataUrl: frameDataUrl,
    };

    const nextList = [...capturedFrames, nextFrame];
    if (stepIndex >= CAPTURE_STEPS.length - 1) {
      stopStream();
      onComplete({
        frames: nextList,
        coverUrl: nextList[0]?.dataUrl || frameDataUrl,
        source: isLive ? 'camera' : 'demo',
        accentHex: '#D96B43',
      });
      return;
    }

    setCapturedFrames(nextList);
    setStepIndex(stepIndex + 1);
  };

  const handlePrevStep = () => {
    if (stepIndex <= 0) return;
    setCapturedFrames((prev) => prev.slice(0, -1));
    setStepIndex(stepIndex - 1);
  };

  const handleQuickDemoCapture = () => {
    const frames = generateAllFallbackSteps();
    stopStream();
    onComplete({
      frames,
      coverUrl: frames[0].dataUrl,
      source: 'demo',
      accentHex: '#D96B43',
    });
  };

  const onionSkinUrl =
    showOnionSkin && stepIndex >= 1 ? capturedFrames[capturedFrames.length - 1]?.dataUrl : '';

  const tiltAlignmentOk =
    measuredTiltDeg !== null && Math.abs(measuredTiltDeg - currentStep.tiltDeg) <= 14;

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-[#1A1614] text-white">
      {cameraStatus === 'ready' ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[#231D19]" />
      )}

      {/* Top instruction HUD */}
      <header className="relative z-10 bg-gradient-to-b from-black/85 via-black/55 to-transparent px-4 pt-4 pb-5">
        <div className="mx-auto flex max-w-2xl items-start justify-between gap-3">
          <div className="min-w-0 flex-1 rounded-2xl bg-black/60 px-4 py-3">
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-[#E88A66]">
              <span className="truncate">{currentStep.stageTitle}</span>
              <span className="tabular-nums text-[#E5DDD5] shrink-0" data-testid="capture-step-counter">
                Шаг {stepIndex + 1} из {CAPTURE_STEPS.length}
              </span>
            </div>
            <h1
              className="mt-1 text-base font-bold leading-snug text-white sm:text-lg"
              data-testid="capture-instruction"
            >
              {currentStep.instruction}
            </h1>
            <p className="mt-1 text-xs text-[#D5CCC3]">
              Угол наклона камеры: {currentStep.tiltRangeLabel} · Ракурс: {currentStep.shortLabel}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              stopStream();
              onCancel();
            }}
            aria-label="Закрыть съёмку"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black/60 text-white transition-colors hover:bg-black/80"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 9-step progress bar */}
        <div className="mx-auto mt-2.5 grid max-w-2xl grid-cols-9 gap-1.5">
          {CAPTURE_STEPS.map((s) => {
            const done = s.index < stepIndex;
            const active = s.index === stepIndex;
            return (
              <div
                key={s.index}
                className={`h-1.5 rounded-full transition-colors ${
                  done
                    ? 'bg-[#D96B43]'
                    : active
                      ? 'bg-white'
                      : 'bg-white/25'
                }`}
              />
            );
          })}
        </div>

        {cameraStatus !== 'ready' && (
          <div className="mx-auto mt-2.5 flex max-w-2xl flex-wrap items-center justify-between gap-2 rounded-2xl bg-black/75 px-3.5 py-2 text-xs text-[#E5DDD5]">
            <span className="min-w-[160px] flex-1 leading-snug">{cameraError}</span>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleRequestCamera}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-[#231E1A] hover:bg-[#FAF8F5] whitespace-nowrap shrink-0"
              >
                <Camera className="h-3.5 w-3.5 text-[#D96B43]" aria-hidden="true" />
                <span>Запросить камеру</span>
              </button>
              <button
                type="button"
                onClick={handleQuickDemoCapture}
                data-testid="capture-auto-demo-btn"
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25 whitespace-nowrap shrink-0"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#E88A66]" aria-hidden="true" />
                <span>Авто-демо (9)</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Center framing viewport with ghost overlay & tilt horizon gauge */}
      <div className="pointer-events-none relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-6">
        <div
          ref={frameBoxRef}
          data-testid="capture-frame-box"
          className="relative h-56 w-56 overflow-hidden rounded-2xl sm:h-68 sm:w-68"
          style={{
            boxShadow: '0 0 0 9999px rgba(18, 14, 12, 0.52)',
          }}
        >
          {cameraStatus !== 'ready' && (
            <div className="absolute inset-0 bg-gradient-to-b from-[#EFE8DE] to-[#DED4C6]" />
          )}

          {cameraStatus !== 'ready' && fallbackPreviewUrl && (
            <img
              src={fallbackPreviewUrl}
              alt="Предпросмотр шага"
              className="relative z-0 h-full w-full object-contain p-3"
            />
          )}

          {/* Ghost onion-skin previous frame overlay for consistent scale & center */}
          {onionSkinUrl && (
            <img
              src={onionSkinUrl}
              alt=""
              aria-hidden="true"
              className={`absolute inset-0 h-full w-full ${
                cameraStatus === 'ready'
                  ? 'object-cover opacity-30 mix-blend-screen'
                  : 'object-contain p-3 opacity-25'
              }`}
            />
          )}

          {/* Square framing reticle */}
          <div className="absolute inset-0 rounded-2xl border-2 border-white/80">
            <span className="absolute top-0 left-0 h-5 w-5 rounded-tl-2xl border-t-3 border-l-3 border-[#D96B43]" />
            <span className="absolute top-0 right-0 h-5 w-5 rounded-tr-2xl border-t-3 border-r-3 border-[#D96B43]" />
            <span className="absolute bottom-0 left-0 h-5 w-5 rounded-bl-2xl border-b-3 border-l-3 border-[#D96B43]" />
            <span className="absolute bottom-0 right-0 h-5 w-5 rounded-br-2xl border-b-3 border-r-3 border-[#D96B43]" />
          </div>

          {/* Center alignment crosshair */}
          <div
            aria-hidden="true"
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <div className="h-5 w-0.5 -translate-x-1/2 bg-[#D96B43]/85" />
            <div className="absolute top-1/2 left-1/2 h-0.5 w-5 -translate-x-1/2 -translate-y-1/2 bg-[#D96B43]/85" />
          </div>

          {/* Semi-transparent ghost silhouette guide */}
          <svg
            viewBox="0 0 200 200"
            className="absolute inset-0 h-full w-full opacity-80"
            aria-hidden="true"
          >
            <polygon
              points={wireframeGuide.frontPoly}
              fill="rgba(217, 107, 67, 0.14)"
              stroke="#D96B43"
              strokeWidth="1.5"
            />
            {wireframeGuide.edges.map(([a, b], idx) => (
              <line
                key={idx}
                x1={wireframeGuide.projected[a][0]}
                y1={wireframeGuide.projected[a][1]}
                x2={wireframeGuide.projected[b][0]}
                y2={wireframeGuide.projected[b][1]}
                stroke="rgba(255,255,255,0.65)"
                strokeWidth="1.25"
                strokeDasharray="3 3"
              />
            ))}
            <line
              x1={wireframeGuide.arrowStart[0]}
              y1={wireframeGuide.arrowStart[1]}
              x2={wireframeGuide.arrowEnd[0]}
              y2={wireframeGuide.arrowEnd[1]}
              stroke="#D96B43"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle
              cx={wireframeGuide.arrowEnd[0]}
              cy={wireframeGuide.arrowEnd[1]}
              r="4"
              fill="#D96B43"
            />
          </svg>
        </div>

        <p
          data-testid="capture-crop-hint"
          className="relative z-10 mt-2.5 max-w-xs rounded-xl bg-black/75 px-3 py-1.5 text-center text-xs font-medium leading-snug text-[#FAF8F5]"
        >
          Удерживайте объект в центре рамки и одного масштаба на всех 9 снимках
        </p>

        {/* Camera Horizon / Tilt Level Indicator */}
        <aside
          aria-label="Уровень наклона камеры"
          className="pointer-events-none absolute top-1/2 right-3 z-10 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-2xl bg-black/65 px-2 py-2.5 text-[11px]"
        >
          {[
            { deg: 90, label: '90°' },
            { deg: 10, label: '0°' },
          ].map((tick) => {
            const isTarget = currentStep.tiltDeg === tick.deg;
            return (
              <div
                key={tick.label}
                className={`flex w-10 items-center justify-center rounded-lg py-1 font-semibold tabular-nums ${
                  isTarget
                    ? 'bg-[#D96B43] text-white'
                    : 'text-[#CFC6BE]/70'
                }`}
              >
                {tick.label}
              </div>
            );
          })}
          <span
            className={`mt-0.5 text-[10px] font-medium tabular-nums ${
              tiltAlignmentOk ? 'text-[#86D993]' : 'text-[#E5DDD5]'
            }`}
          >
            {measuredTiltDeg !== null ? `${measuredTiltDeg}°` : currentStep.tiltRangeLabel}
          </span>
        </aside>
      </div>

      {/* Bottom shutter bar */}
      <div className="relative z-10 bg-gradient-to-t from-black/90 via-black/65 to-transparent px-4 pt-3 pb-6">
        <div className="mx-auto grid max-w-2xl grid-cols-[1fr_auto_1fr] items-center gap-2.5">
          <div className="flex justify-start">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={handlePrevStep}
                aria-label="Вернуться к предыдущему шагу"
                className="flex min-h-[46px] items-center gap-1.5 rounded-2xl bg-white/15 px-3.5 py-2 text-xs font-medium text-white hover:bg-white/25 whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Назад</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleCaptureStep}
            data-testid="capture-frame-btn"
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#D96B43] px-5 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:bg-[#C25832] active:scale-95 whitespace-nowrap shrink-0"
          >
            {stepIndex === CAPTURE_STEPS.length - 1 ? (
              <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <Camera className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span>
              {stepIndex === CAPTURE_STEPS.length - 1 ? 'Завершить съёмку' : 'Снять кадр'}
            </span>
          </button>

          <div className="flex justify-end">
            {stepIndex >= 1 ? (
              <button
                type="button"
                onClick={() => setShowOnionSkin((v) => !v)}
                aria-pressed={showOnionSkin}
                aria-label="Переключить призрак предыдущего кадра"
                className={`flex min-h-[46px] items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  showOnionSkin
                    ? 'bg-white text-[#231E1A]'
                    : 'bg-white/15 text-white hover:bg-white/25'
                }`}
              >
                {showOnionSkin ? (
                  <Eye className="h-4 w-4 text-[#D96B43] shrink-0" aria-hidden="true" />
                ) : (
                  <EyeOff className="h-4 w-4 shrink-0" aria-hidden="true" />
                )}
                <span>Призрак</span>
              </button>
            ) : (
              <span className="text-[11px] font-medium text-[#CFC6BE] tabular-nums">
                9 кадров
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
