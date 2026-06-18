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
