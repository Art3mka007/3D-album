import { ORBIT_VIEW_COUNT, type CameraPreset } from '../types/album';

export interface CrossfadeLayers {
  primaryIndex: number;
  secondaryIndex: number;
  primaryOpacity: number;
  secondaryOpacity: number;
  activeNearestIndex: number;
  activeDeg: number;
}

export interface OrbitPhysicsState {
  orbitPos: number;
  velocity: number;
}

export const SHOWCASE_CAMERA_DISTANCE = 3.1;
export const SHOWCASE_PROJ_SCALE = 0.52;

/**
 * Projects a 3D wireframe point into 2D viewport coordinates for the CaptureScreen ghost guide.
 */
export function projectGhostPoint(
  px: number,
  py: number,
  pz: number,
  cosY: number,
  sinY: number,
  cosT: number,
  sinT: number,
  width: number,
  height: number,
): [number, number] {
  const rx = px * cosY - pz * sinY;
  const rz0 = px * sinY + pz * cosY;

  const cx = rx;
  const cy = py * cosT - rz0 * sinT;
  const cz = py * sinT + rz0 * cosT;

  const persp = SHOWCASE_CAMERA_DISTANCE / Math.max(0.45, SHOWCASE_CAMERA_DISTANCE - cz);
  const u = (0.5 + cx * persp * SHOWCASE_PROJ_SCALE) * (width - 1);
  const v = (0.5 - cy * persp * SHOWCASE_PROJ_SCALE) * (height - 1);
  return [u, v];
}

/**
 * Wraps a continuous orbit index into [0, count).
 */
export function wrapOrbitIndex(pos: number, count = ORBIT_VIEW_COUNT): number {
  const mod = pos % count;
  return mod < 0 ? mod + count : mod;
}

/**
 * Computes shortest signed delta between two continuous indices modulo `count`.
 */
export function shortestOrbitDelta(
  from: number,
  to: number,
  count = ORBIT_VIEW_COUNT,
): number {
  const diff = wrapOrbitIndex(to - from, count);
  return diff > count / 2 ? diff - count : diff;
}

/**
 * Computes the two adjacent circular angle layers and crossfade opacities
 * for any continuous `orbitPos` in 0..8.
 */
export function computeCrossfadeLayers(
  orbitPos: number,
  count = ORBIT_VIEW_COUNT,
): CrossfadeLayers {
  const wrapped = wrapOrbitIndex(orbitPos, count);
  const primaryIndex = Math.floor(wrapped) % count;
  const secondaryIndex = (primaryIndex + 1) % count;
  const frac = wrapped - Math.floor(wrapped);
  const activeNearestIndex = Math.round(wrapped) % count;

  return {
    primaryIndex,
    secondaryIndex,
    primaryOpacity: 1 - frac,
    secondaryOpacity: frac,
    activeNearestIndex,
    activeDeg: activeNearestIndex * (360 / count),
  };
}

/**
 * Advances inertial 2.5D swipe physics and smoothly snaps to the nearest 45° stop.
 */
export function stepOrbitInertia(
  state: OrbitPhysicsState,
  dtSec: number,
  count = ORBIT_VIEW_COUNT,
): { orbitPos: number; velocity: number; settled: boolean } {
  const clampedDt = Math.max(0.001, Math.min(0.05, dtSec));
  let orbitPos = state.orbitPos + state.velocity * clampedDt;
  // Exponential velocity friction (~0.92 per 16ms frame)
  let velocity = state.velocity * Math.pow(0.012, clampedDt);

  if (Math.abs(velocity) < 0.55) {
    const target = Math.round(orbitPos);
    const diff = target - orbitPos;
    const pull = diff * Math.min(1, clampedDt * 12);
    orbitPos += pull;
    velocity *= Math.pow(0.004, clampedDt);

    if (Math.abs(target - orbitPos) < 0.008 && Math.abs(velocity) < 0.04) {
      return {
        orbitPos: wrapOrbitIndex(target, count),
        velocity: 0,
        settled: true,
      };
    }
  }

  return {
    orbitPos: wrapOrbitIndex(orbitPos, count),
    velocity,
    settled: false,
  };
}

export function resolvePresetTarget(
  currentTopActive: boolean,
  preset: CameraPreset,
  currentOrbitPos: number,
): { topActive: boolean; targetOrbitPos: number; presetMatched: CameraPreset } {
  if (preset === 'top') {
    const nextTop = !currentTopActive;
    return {
      topActive: nextTop,
      targetOrbitPos: wrapOrbitIndex(Math.round(currentOrbitPos), ORBIT_VIEW_COUNT),
      presetMatched: nextTop ? 'top' : 'front',
    };
  }

  const slotMap: Record<Exclude<CameraPreset, 'top'>, number> = {
    front: 0,
    right: 2,
    back: 4,
    left: 6,
  };
  const desired = slotMap[preset];
  const delta = shortestOrbitDelta(currentOrbitPos, desired, ORBIT_VIEW_COUNT);

  return {
    topActive: false,
    targetOrbitPos: currentOrbitPos + delta,
    presetMatched: preset,
  };
}
