export type ProjectDuration = '5s' | '10s' | '15s' | '30s';
export type ProjectPlatform = 'TikTok' | 'Reels' | 'Shorts' | 'YouTube';

export type EngineStatus = 'Active' | 'Preparing' | 'Provider Connection Pending' | 'Inactive';

export interface PlatformStatus {
  blueprintEngine: EngineStatus;
  maxQualityPlanning: EngineStatus;
  mediaAnalysis: EngineStatus;
  renderEngine: EngineStatus;
}

export interface TimelineBlock {
  id: string;
  timestamp: string; // e.g. "0.0s - 3.0s"
  title: string;
  description: string;
  visualCue: string;
  audioAction: string;
  speedRamp: string; // e.g. "Normal", "Fast-In / Slow-Out (400% -> 100%)"
  fracture?: boolean;
  caption?: string;
}

import { SoundDesignSettings, SoundEvent } from '@/lib/soundDesignCompiler';

export interface MaxQualitySettings {
  stabilization: boolean;
  denoise: boolean;
  sharpen: boolean;
  colorRecovery: boolean;
  upscaleFactor: 'none' | '2x' | '4x';
  resolution: '720p' | '1080p' | '4K';
}

export interface QualityMetrics {
  resolution: string;
  fps: number;
  bitrateKbps: number;
  noiseScore: number;
  shakeScore: number;
  blurScore: number;
}

export interface QualityDiagnostics {
  before?: QualityMetrics;
  after?: QualityMetrics;
  enhancementsApplied?: string[];
}

export interface EditDNABlueprint {
  editTitle: string;
  viewerEmotion: string;
  hookStrategy: string;
  timelineBlocks: TimelineBlock[];
  cutRhythm: string;
  speedRampPlan: string;
  vfxDirection: string;
  captionStyle: string;
  colorGrade: string;
  soundDirection: string;
  maxQualityPlan: string;
  exportRecommendation: string;
  soundDesignSettings?: SoundDesignSettings;
  soundEvents?: SoundEvent[];
  maxQualitySettings?: MaxQualitySettings;
}

export interface Project {
  id: string;
  title: string;
  selectedMode: string; // ID of the CineForgeMode
  maxQualityMode: boolean;
  mediaFilename: string;
  mediaSize?: string;
  duration: ProjectDuration;
  platform: ProjectPlatform;
  status: PlatformStatus;
  createdAt: string;
  blueprint: EditDNABlueprint;
  sourceType?: 'upload' | 'demo';
  sourceUrl?: string;
}

export interface CreateProjectInput {
  title: string;
  selectedMode: string;
  maxQualityMode: boolean;
  mediaFilename: string;
  mediaSize?: string;
  duration: ProjectDuration;
  platform: ProjectPlatform;
  prompt: string;
  sourceType?: 'upload' | 'demo';
  sourceUrl?: string;
}

export interface CineForgeMode {
  id: string;
  name: string;
  description: string;
  visualSignature: string;
  pacingPreset: string;
  audioProfile: string;
  viewerEmotion: string;
  glowColor: string; // Tailored color theme e.g., 'cyan', 'magenta', 'amber', etc.
}

export interface ProjectVersion {
  id: string;
  projectId: string;
  versionNumber: number;
  blueprint: EditDNABlueprint;
  outputPath: string;
  diagnostics?: any;
  createdAt: string;
}

export interface BrandPreset {
  id: string;
  userId?: string;
  name: string;
  tone?: string;
  colorMood?: string;
  captionStyle?: string;
  ctaStyle?: string;
  platformPreference?: string;
  motionStyle?: string;
  soundDesignStyle?: string;
  createdAt: string;
}
