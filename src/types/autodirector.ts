export interface AutoDirectorShot {
  startTime: number;
  endTime: number;
  shotType: 'close_up' | 'wide_establishing' | 'medium_action' | 'pan_reveal';
  subjectDescription: string;
  motionIntensity: 'static' | 'slow_drift' | 'rapid_pan' | 'unstable';
  usableScore: number; // 0.0 to 10.0
}

export interface AutoDirectorAnalysis {
  detectedNiche: string;
  dominantColorPalette: string[];
  usableDuration: number;
  unusableClips: { start: number; end: number; reason: string }[];
  compositionSequence: AutoDirectorShot[];
}

export interface ReferenceDna {
  id: string;
  userId?: string;
  title: string;
  sourceFilename: string;
  pacingRhythm: string[]; // e.g. ['0.5s', '1.2s']
  averageShotDuration: number;
  dominantColorGrade?: string;
  captionPlacement: string; // e.g. 'center_pulsing'
  soundtrackBeatIntervals?: number[];
  transitionStyles?: string[];
  createdAt: string;
}
