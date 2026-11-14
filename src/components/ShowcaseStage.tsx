import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ORBIT_VIEW_COUNT,
  TOP_VIEW_INDEX,
  getPodiumTheme,
  type AlbumItem,
  type CameraPreset,
} from '../types/album';
import {
  computeCrossfadeLayers,
  resolvePresetTarget,
  stepOrbitInertia,
  wrapOrbitIndex,
} from '../utils/showcaseOrbit';

interface ShowcaseStageProps {
  item: AlbumItem;
  requestedPreset: CameraPreset;
  presetVersion: number;
  onActiveStateChange: (state: {
    topActive: boolean;
    activeDeg: number;
    activePreset: CameraPreset | null;
  }) => void;
}

const ANGLE_TO_PRESET: Record<number, CameraPreset> = {
  0: 'front',
  90: 'right',
  180: 'back',
  270: 'left',
};

export const ShowcaseStage: React.FC<ShowcaseStageProps> = ({
  item,
  requestedPreset,
  presetVersion,
  onActiveStateChange,
}) => {
  const [orbitPos, setOrbitPos] = useState(0);
  const [topActive, setTopActive] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const orbitPosRef = useRef(0);
  const topActiveRef = useRef(false);
  const velocityRef = useRef(0);
  const dragActiveRef = useRef(false);
  const lastXRef = useRef(0);
  const lastMoveTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const targetTweenRef = useRef<number | null>(null);
  const lastHandledPresetVerRef = useRef(0);

  const podium = useMemo(() => getPodiumTheme(item.accentHex), [item.accentHex]);

  const stopAnimations = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (targetTweenRef.current !== null) {
      cancelAnimationFrame(targetTweenRef.current);
      targetTweenRef.current = null;
    }
  };

  // Pre-decode all 9 high-resolution PNG frames on mount so swiping & crossfading stay instant and flicker-free
  useEffect(() => {
    const preloaders: HTMLImageElement[] = [];
    for (const v of item.views) {
      const img = new Image();
      img.src = v.dataUrl;
      if (typeof img.decode === 'function') {
        img.decode().catch(() => {});
      }
      preloaders.push(img);
    }
    return () => {
      preloaders.length = 0;
    };
  }, [item.views]);

  // Reset orbit whenever switching items
  useEffect(() => {
    stopAnimations();
    orbitPosRef.current = 0;
    topActiveRef.current = false;
    velocityRef.current = 0;
    setOrbitPos(0);
    setTopActive(false);
    return () => stopAnimations();
  }, [item.id]);

  const layers = useMemo(() => computeCrossfadeLayers(orbitPos, ORBIT_VIEW_COUNT), [orbitPos]);

  useEffect(() => {
    const activePreset: CameraPreset | null = topActive
      ? 'top'
      : (ANGLE_TO_PRESET[layers.activeDeg] ?? null);
    onActiveStateChange({
      topActive,
      activeDeg: topActive ? 90 : layers.activeDeg,
      activePreset,
    });
  }, [topActive, layers.activeDeg, onActiveStateChange]);

  useEffect(() => {
    if (presetVersion === 0 || presetVersion === lastHandledPresetVerRef.current) return;
    lastHandledPresetVerRef.current = presetVersion;

    const resolved = resolvePresetTarget(
      topActiveRef.current,
      requestedPreset,
      orbitPosRef.current,
    );

    stopAnimations();
    velocityRef.current = 0;

    if (requestedPreset === 'top') {
      topActiveRef.current = resolved.topActive;
      setTopActive(resolved.topActive);
      return;
    }

    topActiveRef.current = false;
    setTopActive(false);

    const startPos = orbitPosRef.current;
    const endPos = resolved.targetOrbitPos;
    const startTime = performance.now();
    const durationMs = 260;

    const animatePreset = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = wrapOrbitIndex(startPos + (endPos - startPos) * eased, ORBIT_VIEW_COUNT);
      orbitPosRef.current = next;
      setOrbitPos(next);

      if (t < 1) {
        targetTweenRef.current = requestAnimationFrame(animatePreset);
      } else {
        targetTweenRef.current = null;
      }
    };
    targetTweenRef.current = requestAnimationFrame(animatePreset);
  }, [presetVersion, requestedPreset]);

  const startInertiaLoop = () => {
    stopAnimations();
    let prevTime = performance.now();

    const tick = (now: number) => {
      const dtSec = (now - prevTime) / 1000;
      prevTime = now;

      const step = stepOrbitInertia(
        { orbitPos: orbitPosRef.current, velocity: velocityRef.current },
        dtSec,
        ORBIT_VIEW_COUNT,
      );
      orbitPosRef.current = step.orbitPos;
      velocityRef.current = step.velocity;
      setOrbitPos(step.orbitPos);

      if (!step.settled) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    stopAnimations();
    dragActiveRef.current = true;
    setIsDragging(true);
    lastXRef.current = e.clientX;
    lastMoveTimeRef.current = performance.now();
    velocityRef.current = 0;

    if (topActiveRef.current) {
      topActiveRef.current = false;
      setTopActive(false);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragActiveRef.current) return;
    const now = performance.now();
    const dx = e.clientX - lastXRef.current;
    const dtMs = Math.max(8, now - lastMoveTimeRef.current);

    const stepDelta = -dx / 62;
    const nextPos = wrapOrbitIndex(orbitPosRef.current + stepDelta, ORBIT_VIEW_COUNT);
    orbitPosRef.current = nextPos;
    setOrbitPos(nextPos);

    const instantVel = (stepDelta / dtMs) * 1000;
    velocityRef.current = velocityRef.current * 0.45 + instantVel * 0.55;

    lastXRef.current = e.clientX;
    lastMoveTimeRef.current = now;
  };

  const handlePointerUp = () => {
    if (!dragActiveRef.current) return;
    dragActiveRef.current = false;
    setIsDragging(false);
    velocityRef.current = Math.max(-14, Math.min(14, velocityRef.current));
    startInertiaLoop();
  };

  const circularViews = item.views.slice(0, ORBIT_VIEW_COUNT);
  const primaryView = circularViews[layers.primaryIndex] ?? item.views[0];
  const secondaryView = circularViews[layers.secondaryIndex] ?? item.views[0];
  const topView = item.views[TOP_VIEW_INDEX] ?? item.views[0];

  const subStep = orbitPos - Math.floor(orbitPos);
  const microShiftPx = topActive ? 0 : (0.5 - subStep) * 4;

  return (
    <div
      data-testid="showcase-stage"
      data-active-angle={topActive ? 'top' : String(layers.activeDeg)}
      data-top-active={topActive ? 'true' : 'false'}
      data-orbit-index={String(layers.activeNearestIndex)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative flex h-full w-full flex-col items-center justify-center select-none touch-none ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {/* Subtle studio glow tuned to podium shade */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl transition-colors duration-300"
        style={{ backgroundColor: podium.glowFill }}
      />

      {/* Transparent cutout object standing directly on top of the graphical 2.5D podium */}
      <div className="relative flex flex-col items-center">
        <div
          className="relative z-10 h-60 w-60 sm:h-72 sm:w-72"
          style={{
            transform: `translate3d(${microShiftPx.toFixed(1)}px, 0, 0)`,
          }}
        >
          {/* Circular 8-angle crossfade layers (no opaque card frame!) */}
          <div
            className={`absolute inset-0 transition-opacity duration-200 ${
              topActive ? 'opacity-0' : 'opacity-100'
            }`}
          >
            {primaryView && (
              <img
                src={primaryView.dataUrl}
                alt={`${item.title} — ракурс ${primaryView.shortLabel}`}
                draggable={false}
                className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_6px_10px_rgba(35,30,26,0.14)]"
                style={{ opacity: layers.primaryOpacity }}
              />
            )}
            {secondaryView && layers.secondaryOpacity > 0.01 && (
              <img
                src={secondaryView.dataUrl}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_6px_10px_rgba(35,30,26,0.14)]"
                style={{ opacity: layers.secondaryOpacity }}
              />
            )}
          </div>

          {/* Top-down 90° crossfade layer */}
          {topView && (
            <img
              src={topView.dataUrl}
              alt={`${item.title} — вид сверху`}
              draggable={false}
              className={`absolute inset-0 h-full w-full object-contain drop-shadow-[0_6px_10px_rgba(35,30,26,0.14)] transition-opacity duration-200 ${
                topActive ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            />
          )}
        </div>

        {/* Graphical 2.5D Podium directly beneath cutout object with soft contact shadow */}
        <div
          aria-hidden="true"
          className="pointer-events-none relative -mt-14 flex flex-col items-center sm:-mt-16"
        >
          <svg
            viewBox="0 0 320 76"
            className="h-18 w-72 drop-shadow-[0_14px_22px_rgba(35,30,26,0.16)] sm:h-20 sm:w-84"
          >
            <ellipse cx="160" cy="44" rx="146" ry="26" fill="#E6DDD1" />
            <ellipse cx="160" cy="39" rx="146" ry="24" fill="#FAF8F5" />
            <path
              d="M 28 24 L 28 38 A 132 22 0 0 0 292 38 L 292 24 Z"
              fill={podium.sideFill}
            />
            <ellipse cx="160" cy="24" rx="132" ry="22" fill={podium.rimFill} />
            <ellipse cx="160" cy="23" rx="122" ry="18.5" fill={podium.topFill} />
            {/* Soft contact shadow right under object base */}
            <ellipse cx="160" cy="23" rx="82" ry="11.5" fill="rgba(35, 30, 26, 0.25)" />
          </svg>
        </div>

        {/* Clean unboxed angle label + 8-step orbit indicator */}
        <div className="mt-1 flex items-center gap-2.5 text-xs text-[#6E645B] tabular-nums">
          <span data-testid="showcase-angle-label" className="font-medium text-[#231E1A]">
            {topActive ? 'Вид сверху' : `${layers.activeDeg}°`}
          </span>
          {!topActive && (
            <>
              <span aria-hidden="true">·</span>
              <div className="flex items-center gap-1" aria-hidden="true">
                {Array.from({ length: ORBIT_VIEW_COUNT }).map((_, idx) => {
                  const active = idx === layers.activeNearestIndex;
                  return (
                    <span
                      key={idx}
                      className={`h-1.5 rounded-full transition-all duration-150 ${
                        active ? 'w-4 bg-[#D96B43]' : 'w-1.5 bg-[#231E1A]/20'
                      }`}
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
