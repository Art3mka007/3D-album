export type ModelType = 'zenit' | 'sneakers' | 'avocado' | 'custom';

export type CaptureSource = 'camera' | 'gallery' | 'demo';

export interface AlbumItem {
  id: string;
  title: string;
  note: string;
  createdAt: string;
  coverUrl: string;
  modelType: ModelType;
  source: CaptureSource;
  /** Optional secondary frame URLs captured during the 360° orbit */
  frames?: string[];
  /** Dominant warm accent tint extracted or chosen for custom 3D pedestal */
  accentHex?: string;
}

export interface CapturedDraft {
  frames: string[];
  selectedCoverUrl: string;
  source: CaptureSource;
  accentHex?: string;
}

export type AppScreen = 'gallery' | 'capture' | 'processing' | 'viewer';
