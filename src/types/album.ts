export type CaptureSource = 'camera' | 'demo';

export type CaptureStage = 1 | 2;

export interface CaptureStepMeta {
  /** 0..8 = 8 horizontal 45° views + 1 final top-down view (90°) */
  index: number;
  stage: CaptureStage;
  stageTitle: string;
  instruction: string;
  shortLabel: string;
  /** Object yaw turn in degrees (0, 45, 90, 135, 180, 225, 270, 315) */
  yawDeg: number;
  /** Camera elevation tilt from horizon in degrees (10 = eye level 0-15°, 90 = top-down) */
  tiltDeg: number;
  tiltRangeLabel: string;
}

export const CAPTURE_RESOLUTION = 1024;
export const DEMO_RESOLUTION = 768;
export const ORBIT_VIEW_COUNT = 8;
export const TOP_VIEW_INDEX = 8;

export const CAPTURE_STEPS: CaptureStepMeta[] = [
  {
    index: 0,
    stage: 1,
    stageTitle: 'Этап 1: Круговой обзор (0–15°)',
    instruction: 'Поставьте предмет лицевой стороной (0°)',
    shortLabel: '0°',
    yawDeg: 0,
    tiltDeg: 10,
    tiltRangeLabel: '0–15°',
  },
  {
    index: 1,
    stage: 1,
    stageTitle: 'Этап 1: Круговой обзор (0–15°)',
    instruction: 'Поверните предмет влево на 45°',
    shortLabel: '45°',
    yawDeg: 45,
    tiltDeg: 10,
    tiltRangeLabel: '0–15°',
  },
  {
    index: 2,
    stage: 1,
    stageTitle: 'Этап 1: Круговой обзор (0–15°)',
    instruction: 'Поверните предмет на 90° (правый бок)',
    shortLabel: '90°',
    yawDeg: 90,
    tiltDeg: 10,
    tiltRangeLabel: '0–15°',
  },
  {
    index: 3,
    stage: 1,
    stageTitle: 'Этап 1: Круговой обзор (0–15°)',
    instruction: 'Поверните предмет на 135°',
    shortLabel: '135°',
    yawDeg: 135,
    tiltDeg: 10,
    tiltRangeLabel: '0–15°',
  },
  {
    index: 4,
    stage: 1,
    stageTitle: 'Этап 1: Круговой обзор (0–15°)',
    instruction: 'Поверните предмет на 180° (задняя сторона)',
    shortLabel: '180°',
    yawDeg: 180,
    tiltDeg: 10,
    tiltRangeLabel: '0–15°',
  },
  {
    index: 5,
    stage: 1,
    stageTitle: 'Этап 1: Круговой обзор (0–15°)',
    instruction: 'Поверните предмет на 225°',
    shortLabel: '225°',
    yawDeg: 225,
    tiltDeg: 10,
    tiltRangeLabel: '0–15°',
  },
  {
    index: 6,
    stage: 1,
    stageTitle: 'Этап 1: Круговой обзор (0–15°)',
    instruction: 'Поверните предмет на 270° (левый бок)',
    shortLabel: '270°',
    yawDeg: 270,
    tiltDeg: 10,
    tiltRangeLabel: '0–15°',
  },
  {
    index: 7,
    stage: 1,
    stageTitle: 'Этап 1: Круговой обзор (0–15°)',
    instruction: 'Поверните предмет на 315°',
    shortLabel: '315°',
    yawDeg: 315,
    tiltDeg: 10,
    tiltRangeLabel: '0–15°',
  },
  {
    index: 8,
    stage: 2,
    stageTitle: 'Этап 2: Финальный кадр сверху',
    instruction: 'Направьте камеру строго сверху вниз (90°)',
    shortLabel: 'Сверху',
    yawDeg: 0,
    tiltDeg: 90,
    tiltRangeLabel: '90°',
  },
];

export interface PodiumTheme {
  hex: string;
  label: string;
  topFill: string;
  rimFill: string;
  sideFill: string;
  glowFill: string;
}

export const PODIUM_THEMES: PodiumTheme[] = [
  {
    hex: '#D96B43',
    label: 'Терракота',
    topFill: '#E89575',
    rimFill: '#D96B43',
    sideFill: '#B6522F',
    glowFill: 'rgba(217, 107, 67, 0.18)',
  },
  {
    hex: '#6F8B58',
    label: 'Шалфей',
    topFill: '#96B080',
    rimFill: '#6F8B58',
    sideFill: '#51693E',
    glowFill: 'rgba(111, 139, 88, 0.18)',
  },
  {
    hex: '#4A433D',
    label: 'Графит',
    topFill: '#726961',
    rimFill: '#4A433D',
    sideFill: '#2E2925',
    glowFill: 'rgba(74, 67, 61, 0.16)',
  },
  {
    hex: '#C9965B',
    label: 'Охра',
    topFill: '#DFB37E',
    rimFill: '#C9965B',
    sideFill: '#9E713D',
    glowFill: 'rgba(201, 150, 91, 0.18)',
  },
];

export function getPodiumTheme(accentHex?: string): PodiumTheme {
  return PODIUM_THEMES.find((t) => t.hex.toLowerCase() === accentHex?.toLowerCase()) ?? PODIUM_THEMES[0];
}

export interface CapturedViewFrame {
  stepIndex: number;
  shortLabel: string;
  yawDeg: number;
  tiltDeg: number;
  /** Lossless high-resolution PNG DataURL (with transparent alpha cutout) */
  dataUrl: string;
}

export interface CapturedDraft {
  frames: CapturedViewFrame[];
  /** Front frame (0°) used as card cover in gallery */
  coverUrl: string;
  source: CaptureSource;
  accentHex?: string;
}

export interface AlbumItem {
  id: string;
  title: string;
  note: string;
  createdAt: string;
  /** Front view (0°) cutout PNG cover image */
  coverUrl: string;
  /** 9 views: indices 0..7 = circular 0°..315°, index 8 = top-down 90° */
  views: CapturedViewFrame[];
  source: CaptureSource;
  accentHex?: string;
}

export type AppScreen = 'gallery' | 'capture' | 'save' | 'viewer';

export type CameraPreset = 'front' | 'right' | 'back' | 'left' | 'top';
