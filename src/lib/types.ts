export type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SessionPage = {
  id: string;
  uri: string;
  width: number;
  height: number;
};

export type FilterId = 'original' | 'grayscale' | 'bw' | 'vivid' | 'magic';

export type Adjustments = {
  brightness: number;
  contrast: number;
  saturation: number;
};

export type ExportFormat = 'pdf' | 'jpg' | 'png';
export type QualityPreset = 'high' | 'medium' | 'low';

export type StoredPage = {
  file: string;
  thumb: string;
  width: number;
  height: number;
};

export type StoredDocument = {
  id: string;
  name: string;
  createdAt: number;
  pages: StoredPage[];
};

export type AppSettings = {
  facing: 'back' | 'front';
  format: ExportFormat;
  quality: QualityPreset;
  fastCapture: boolean;
  onboarded: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  facing: 'back',
  format: 'pdf',
  quality: 'medium',
  fastCapture: false,
  onboarded: false,
};
